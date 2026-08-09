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

const RENDER_CALLBACK_SYNC_FRAMES = 30;

interface RendererPatch {
  deactivate: () => void;
  originalSetData: GraphRendererLike["setData"];
  renderer: GraphRendererLike;
  synchronizeRenderCallback: () => boolean;
  view: GraphViewLike;
  wrapper: GraphRendererLike["setData"];
}

interface RenderCallbackHook {
  deactivate: () => void;
  original: NonNullable<GraphRendererLike["renderCallback"]>;
  wrapper: NonNullable<GraphRendererLike["renderCallback"]>;
}

type FrameWaiter = () => Promise<void>;

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        resolve();
      });
      return;
    }
    setTimeout(resolve, 0);
  });
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
  let active = true;
  let contourLayer: FolderContourLayer | undefined;
  let renderHook: RenderCallbackHook | undefined;

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
    if (!active || !enabled) return;

    try {
      contourLayer = FolderContourLayer.create(renderer);
      if (contourLayer === undefined) return;
      contourLayer.setGroups(groups);
      contourLayer.update();
    } catch (error) {
      clearContours();
      console.warn("Folder Virtual Links could not draw contours", error);
    }
  };

  const createRenderCallbackHook = (
    callback: NonNullable<GraphRendererLike["renderCallback"]>,
  ): RenderCallbackHook => {
    let enabled = true;
    return {
      deactivate: () => {
        enabled = false;
      },
      original: callback,
      wrapper: () => {
        if (enabled && active && contourLayer !== undefined) {
          try {
            contourLayer.update();
          } catch (error) {
            clearContours();
            console.warn(
              "Folder Virtual Links stopped updating contours",
              error,
            );
          }
        }
        return callback.call(renderer);
      },
    };
  };

  const synchronizeRenderCallback = (): boolean => {
    if (!active) return false;

    const callback = renderer.renderCallback;
    if (typeof callback !== "function") return false;
    if (callback === renderHook?.wrapper) return false;

    renderHook?.deactivate();
    renderHook = createRenderCallbackHook(callback);
    renderer.renderCallback = renderHook.wrapper;
    return true;
  };

  const wrapper: GraphRendererLike["setData"] = (data) => {
    if (!active) return originalSetData.call(renderer, data);

    try {
      const settings = getSettings();
      const augmented = augmentGraphData(data, settings);
      clearContours();
      const result = originalSetData.call(renderer, augmented.data);
      synchronizeRenderCallback();
      stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
      replaceContours(augmented.folderGroups, settings.showFolderContours);
      return result;
    } catch (error) {
      console.error("Folder Virtual Links could not update the graph", error);
      clearContours();
      return originalSetData.call(renderer, data);
    }
  };

  return {
    deactivate: () => {
      active = false;
      clearContours();
      const hook = renderHook;
      hook?.deactivate();
      if (hook !== undefined && renderer.renderCallback === hook.wrapper) {
        renderer.renderCallback = hook.original;
      }
    },
    originalSetData,
    renderer,
    synchronizeRenderCallback,
    view,
    wrapper,
  };
}

export class NativeGraphBridge {
  private readonly patches = new Map<GraphRendererLike, RendererPatch>();
  private disposed = false;
  private synchronizationId = 0;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => Readonly<FolderVirtualLinksSettings>,
    private readonly waitForFrame: FrameWaiter = waitForNextFrame,
  ) {}

  patchOpenGraphs(): void {
    if (this.disposed) return;
    for (const patch of this.reconcileOpenGraphs()) {
      refreshView(patch.view);
    }
  }

  async synchronizeAfterWorkspaceChange(
    leaf: WorkspaceLeaf | null,
  ): Promise<void> {
    const synchronizationId = ++this.synchronizationId;
    if (this.isDisposed()) return;

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

    for (let frame = 0; frame < RENDER_CALLBACK_SYNC_FRAMES; frame += 1) {
      if (this.isDisposed() || synchronizationId !== this.synchronizationId) {
        return;
      }
      this.patchOpenGraphs();
      await this.waitForFrame();
    }

    if (synchronizationId === this.synchronizationId) this.patchOpenGraphs();
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
    this.synchronizationId += 1;
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

    const refreshPatches = new Set<RendererPatch>();
    for (const [renderer, view] of openGraphs) {
      const current = this.patches.get(renderer);
      if (current !== undefined) {
        if (current.synchronizeRenderCallback()) refreshPatches.add(current);
        continue;
      }

      const patch = createRendererPatch(view, renderer, this.getSettings);
      renderer.setData = patch.wrapper;
      this.patches.set(renderer, patch);
      patch.synchronizeRenderCallback();
      refreshPatches.add(patch);
    }
    return [...refreshPatches];
  }

  private releasePatch(patch: RendererPatch, refresh: boolean): void {
    patch.deactivate();
    if (patch.renderer.setData === patch.wrapper) {
      patch.renderer.setData = patch.originalSetData;
    }
    this.patches.delete(patch.renderer);
    if (refresh) refreshView(patch.view);
  }

  private isDisposed(): boolean {
    return this.disposed;
  }
}
