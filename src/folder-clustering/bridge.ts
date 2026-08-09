import type { App, WorkspaceLeaf } from "obsidian";
import { augmentGraphData } from "./graph-data";
import { edgeKey } from "./topology";
import type {
  GraphLinkLike,
  GraphRendererLike,
  GraphViewLike,
  TopologyDegree
} from "./types";

interface RendererPatch {
  active: boolean;
  originalSetData: GraphRendererLike["setData"];
  renderer: GraphRendererLike;
  view: GraphViewLike;
  wrapper: GraphRendererLike["setData"];
}

function deleteLinkReference(
  lookup: Record<string, GraphLinkLike> | undefined,
  id: string,
  link: GraphLinkLike
): void {
  if (lookup?.[id] === link) delete lookup[id];
}

export function stripVirtualLinks(
  renderer: GraphRendererLike,
  virtualEdgeKeys: ReadonlySet<string>
): void {
  if (virtualEdgeKeys.size === 0 || !Array.isArray(renderer.links)) return;

  const visibleLinks: GraphLinkLike[] = [];
  for (const link of renderer.links) {
    const sourceId = link.source?.id;
    const targetId = link.target?.id;
    if (
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
      console.warn("Folder Virtual Links could not clear hidden link graphics", error);
    }
    link.rendered = false;
    deleteLinkReference(link.source.forward, targetId, link);
    deleteLinkReference(link.source.reverse, targetId, link);
    deleteLinkReference(link.target.forward, sourceId, link);
    deleteLinkReference(link.target.reverse, sourceId, link);
  }

  renderer.links.splice(0, renderer.links.length, ...visibleLinks);
  for (const node of renderer.nodes ?? []) {
    node.weight = Object.keys(node.forward ?? {}).length + Object.keys(node.reverse ?? {}).length;
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

export class NativeGraphBridge {
  private readonly patches = new Map<GraphRendererLike, RendererPatch>();

  constructor(
    private readonly app: App,
    private readonly getTopologyDegree: () => TopologyDegree
  ) {}

  patchOpenGraphs(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
      const view = asGraphView(leaf);
      const renderer = view?.renderer;
      if (view === undefined || renderer === undefined || this.patches.has(renderer)) continue;
      if (typeof renderer.setData !== "function") continue;

      const patch = this.patchRenderer(view, renderer);
      this.patches.set(renderer, patch);
      refreshView(view);
    }
  }

  refreshAll(): void {
    this.patchOpenGraphs();
    for (const patch of this.patches.values()) {
      if (patch.active) refreshView(patch.view);
    }
  }

  dispose(): void {
    for (const patch of this.patches.values()) {
      patch.active = false;
      if (patch.renderer.setData === patch.wrapper) {
        patch.renderer.setData = patch.originalSetData;
      }
      refreshView(patch.view);
    }
    this.patches.clear();
  }

  private patchRenderer(view: GraphViewLike, renderer: GraphRendererLike): RendererPatch {
    const originalSetData = renderer.setData;
    const patch = {
      active: true,
      originalSetData,
      renderer,
      view
    } as RendererPatch;

    patch.wrapper = (data) => {
      if (!patch.active) return originalSetData.call(renderer, data);
      try {
        const augmented = augmentGraphData(data, this.getTopologyDegree());
        const result = originalSetData.call(renderer, augmented.data);
        stripVirtualLinks(renderer, augmented.virtualEdgeKeys);
        return result;
      } catch (error) {
        console.error("Folder Virtual Links disabled clustering for this graph update", error);
        return originalSetData.call(renderer, data);
      }
    };

    renderer.setData = patch.wrapper;
    return patch;
  }
}
