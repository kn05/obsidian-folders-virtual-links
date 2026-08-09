import type { App, WorkspaceLeaf } from "obsidian";
import { augmentGraphData } from "./graph-data";
import { edgeKey } from "./topology";
import type {
  GraphLinkLike,
  GraphRendererLike,
  GraphViewLike,
  TopologyDegree,
} from "./types";

interface RendererPatch {
  deactivate: () => void;
  originalSetData: GraphRendererLike["setData"];
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
  getTopologyDegree: () => TopologyDegree,
): RendererPatch {
  const originalSetData = renderer.setData;
  let active = true;

  const wrapper: GraphRendererLike["setData"] = (data) => {
    if (!active) return originalSetData.call(renderer, data);

    try {
      const augmented = augmentGraphData(data, getTopologyDegree());
      const result = originalSetData.call(renderer, augmented.data);
      stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
      return result;
    } catch (error) {
      console.error("Folder Virtual Links could not update the graph", error);
      return originalSetData.call(renderer, data);
    }
  };

  return {
    deactivate: () => {
      active = false;
    },
    originalSetData,
    renderer,
    view,
    wrapper,
  };
}

export class NativeGraphBridge {
  private readonly patches = new Map<GraphRendererLike, RendererPatch>();

  constructor(
    private readonly app: App,
    private readonly getTopologyDegree: () => TopologyDegree,
  ) {}

  patchOpenGraphs(): void {
    for (const patch of this.reconcileOpenGraphs()) {
      refreshView(patch.view);
    }
  }

  refreshAll(): void {
    this.reconcileOpenGraphs();
    for (const patch of this.patches.values()) {
      refreshView(patch.view);
    }
  }

  dispose(): void {
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

      const patch = createRendererPatch(view, renderer, this.getTopologyDegree);
      renderer.setData = patch.wrapper;
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
    this.patches.delete(patch.renderer);
    if (refresh) refreshView(patch.view);
  }
}
