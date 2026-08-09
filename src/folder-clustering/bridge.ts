import type { App, WorkspaceLeaf } from "obsidian";
import { FolderContourLayer } from "./contours";
import { augmentGraphData } from "./graph-data";
import { edgeKey } from "./topology";
import type {
  FolderVirtualLinksSettings,
  GraphLinkLike,
  GraphRendererLike,
  GraphViewLike,
} from "./types";

interface RendererPatch {
  deactivate: () => void;
  originalRenderCallback: GraphRendererLike["renderCallback"];
  originalSetData: GraphRendererLike["setData"];
  renderWrapper: GraphRendererLike["renderCallback"];
  renderer: GraphRendererLike;
  view: GraphViewLike;
  wrapper: GraphRendererLike["setData"];
}

function deleteLinkReference(
  lookup: Record<string, GraphLinkLike> | undefined,
  id: string,
  link: GraphLinkLike,
): void {
  if (lookup?.[id] === link) Reflect.deleteProperty(lookup, id);
}

export function stripVirtualLinks(
  renderer: GraphRendererLike,
  virtualEdgeKeys: ReadonlySet<string>,
): void {
  if (virtualEdgeKeys.size === 0 || !Array.isArray(renderer.links)) return;

  const visibleLinks: GraphLinkLike[] = [];
  for (const link of renderer.links) {
    const source = link.source;
    const target = link.target;
    const sourceId = source?.id;
    const targetId = target?.id;
    if (
      source === undefined ||
      target === undefined ||
      typeof sourceId !== "string" ||
      typeof targetId !== "string" ||
      !virtualEdgeKeys.has(edgeKey(sourceId, targetId))
    ) {
      visibleLinks.push(link);
      continue;
    }

    try {
      link.clearGraphics?.();
    } catch (error) {
      console.warn(
        "Folder Virtual Links could not clear hidden link graphics",
        error,
      );
    }
    link.rendered = false;
    deleteLinkReference(source.forward, targetId, link);
    deleteLinkReference(source.reverse, targetId, link);
    deleteLinkReference(target.forward, sourceId, link);
    deleteLinkReference(target.reverse, sourceId, link);
  }

  renderer.links.splice(0, renderer.links.length, ...visibleLinks);
  for (const node of renderer.nodes ?? []) {
    node.weight =
      Object.keys(node.forward ?? {}).length +
      Object.keys(node.reverse ?? {}).length;
  }
  renderer.changed?.();
}

function asGraphView(leaf: WorkspaceLeaf): GraphViewLike | undefined {
  if (leaf.view.getViewType() !== "graph") return undefined;
  return leaf.view as unknown as GraphViewLike;
}

function refreshView(view: GraphViewLike): void {
  if (typeof view.update === "function") {
    view.update();
    return;
  }
  view.dataEngine?.render?.();
}

function createRendererPatch(
  view: GraphViewLike,
  renderer: GraphRendererLike,
  getSettings: () => Readonly<FolderVirtualLinksSettings>,
): RendererPatch {
  const originalSetData = renderer.setData;
  const originalRenderCallback = renderer.renderCallback;
  let active = true;
  let contourLayer: FolderContourLayer | undefined;
  let contoursCompatible = typeof originalRenderCallback === "function";

  const clearContours = () => {
    try {
      contourLayer?.dispose();
    } catch (error) {
      console.warn("Folder Virtual Links could not remove contours", error);
    }
    contourLayer = undefined;
  };

  const replaceContours = (
    groups: ReadonlyMap<string, readonly string[]>,
    enabled: boolean,
  ) => {
    clearContours();
    if (!active || !enabled || !contoursCompatible) return;

    try {
      contourLayer = FolderContourLayer.create(renderer);
      if (contourLayer === undefined) {
        contoursCompatible = false;
        return;
      }
      contourLayer.setGroups(groups);
      contourLayer.update();
    } catch (error) {
      contoursCompatible = false;
      clearContours();
      console.warn("Folder Virtual Links could not draw contours", error);
    }
  };

  const wrapper: GraphRendererLike["setData"] = (data) => {
    if (!active) return originalSetData.call(renderer, data);

    try {
      const settings = getSettings();
      const augmented = augmentGraphData(data, settings);
      clearContours();
      const result = originalSetData.call(renderer, augmented.data);
      stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
      replaceContours(augmented.folderGroups, settings.showFolderContours);
      return result;
    } catch (error) {
      console.error("Folder Virtual Links could not update the graph", error);
      clearContours();
      return originalSetData.call(renderer, data);
    }
  };

  const renderWrapper: GraphRendererLike["renderCallback"] =
    originalRenderCallback === undefined
      ? undefined
      : () => {
          if (active && contourLayer !== undefined) {
            try {
              contourLayer.update();
            } catch (error) {
              contoursCompatible = false;
              clearContours();
              console.warn(
                "Folder Virtual Links stopped updating contours",
                error,
              );
            }
          }
          return originalRenderCallback.call(renderer);
        };

  return {
    deactivate: () => {
      active = false;
      clearContours();
    },
    originalRenderCallback,
    originalSetData,
    renderWrapper,
    renderer,
    view,
    wrapper,
  };
}

export class NativeGraphBridge {
  private readonly patches = new Map<GraphRendererLike, RendererPatch>();
  private disposed = false;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => Readonly<FolderVirtualLinksSettings>,
  ) {}

  patchOpenGraphs(): void {
    if (this.disposed) return;
    for (const patch of this.reconcileOpenGraphs()) {
      refreshView(patch.view);
    }
  }

  async patchAfterLeafLoad(leaf: WorkspaceLeaf | null): Promise<void> {
    if (this.disposed) return;

    if (leaf?.getViewState().type === "graph") {
      try {
        await leaf.loadIfDeferred();
      } catch (error) {
        console.warn(
          "Folder Virtual Links could not load the graph view",
          error,
        );
        return;
      }
    }

    this.patchOpenGraphs();
  }

  refreshAll(): void {
    if (this.disposed) return;
    this.reconcileOpenGraphs();
    for (const patch of this.patches.values()) {
      refreshView(patch.view);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const patch of [...this.patches.values()]) {
      this.releasePatch(patch, true);
    }
  }

  private reconcileOpenGraphs(): RendererPatch[] {
    const openGraphs = new Map<GraphRendererLike, GraphViewLike>();
    for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
      const view = asGraphView(leaf);
      const renderer = view?.renderer;
      if (view === undefined || renderer === undefined) continue;
      if (typeof renderer.setData !== "function") continue;

      openGraphs.set(renderer, view);
    }

    for (const [renderer, patch] of this.patches) {
      if (!openGraphs.has(renderer)) this.releasePatch(patch, false);
    }

    const addedPatches: RendererPatch[] = [];
    for (const [renderer, view] of openGraphs) {
      if (this.patches.has(renderer)) continue;

      const patch = createRendererPatch(view, renderer, this.getSettings);
      renderer.setData = patch.wrapper;
      if (patch.renderWrapper !== undefined) {
        renderer.renderCallback = patch.renderWrapper;
      }
      this.patches.set(renderer, patch);
      addedPatches.push(patch);
    }
    return addedPatches;
  }

  private releasePatch(patch: RendererPatch, refresh: boolean): void {
    patch.deactivate();
    if (patch.renderer.setData === patch.wrapper) {
      patch.renderer.setData = patch.originalSetData;
    }
    if (patch.renderer.renderCallback === patch.renderWrapper) {
      patch.renderer.renderCallback = patch.originalRenderCallback;
    }
    this.patches.delete(patch.renderer);
    if (refresh) refreshView(patch.view);
  }
}
