import { describe, expect, it, vi } from "vitest";
import { NativeGraphBridge, stripVirtualLinks } from "./bridge";
import { FolderContourLayer } from "./contours";
import { edgeKey } from "./topology";
import type {
  FolderVirtualLinksSettings,
  GraphDataLike,
  GraphLinkLike,
  GraphNodeLike,
  GraphRendererLike,
  GraphViewLike,
} from "./types";

const DEFAULT_TEST_SETTINGS: FolderVirtualLinksSettings = {
  excludedFolders: [],
  folderDepth: "direct",
  showFolderContours: true,
  topologyDegree: 3,
};

type CompleteGraphNode = GraphNodeLike & {
  forward: Record<string, GraphLinkLike>;
  reverse: Record<string, GraphLinkLike>;
};

function node(id: string): CompleteGraphNode {
  return { id, forward: {}, reverse: {}, weight: 0 };
}

describe("native graph bridge", () => {
  it("removes virtual foreground links and preserves real ones", () => {
    const a = node("folder/a.md");
    const b = node("folder/b.md");
    const c = node("other/c.md");
    const clearVirtual = vi.fn();
    const virtual = {
      source: a,
      target: b,
      rendered: true,
      clearGraphics: clearVirtual,
    };
    const real = { source: a, target: c, rendered: true };
    a.forward[b.id] = virtual;
    b.reverse[a.id] = virtual;
    a.forward[c.id] = real;
    c.reverse[a.id] = real;
    const changed = vi.fn();
    const renderer = {
      links: [virtual, real],
      nodes: [a, b, c],
      setData: () => undefined,
      changed,
    } satisfies GraphRendererLike;

    stripVirtualLinks(renderer, new Set([edgeKey(a.id, b.id)]));

    expect(renderer.links).toEqual([real]);
    expect(a.forward).toEqual({ [c.id]: real });
    expect(b.reverse).toEqual({});
    expect(a.weight).toBe(1);
    expect(clearVirtual).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledOnce();
  });

  it("does nothing when no virtual edges were added", () => {
    const a = node("a.md");
    const b = node("b.md");
    const link: GraphLinkLike = { source: a, target: b };
    const renderer: GraphRendererLike = {
      links: [link],
      nodes: [a, b],
      setData: () => undefined,
    };
    stripVirtualLinks(renderer, new Set());
    expect(renderer.links).toEqual([link]);
  });

  it("feeds augmented data to the native renderer and strips only its virtual links", () => {
    const data: GraphDataLike = {
      nodes: {
        "folder/a.md": { type: "", links: {} },
        "folder/b.md": { type: "", links: {} },
        "folder/c.md": { type: "", links: {} },
      },
      numLinks: 0,
    };
    let received: GraphDataLike | undefined;
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData(next) {
        received = next;
        const byId = Object.fromEntries(
          Object.keys(next.nodes).map((id) => [id, node(id)]),
        ) as Record<string, CompleteGraphNode>;
        this.nodes = Object.values(byId);
        const links: GraphLinkLike[] = [];
        this.links = links;
        for (const [sourceId, sourceData] of Object.entries(next.nodes)) {
          for (const targetId of Object.keys(sourceData.links)) {
            const source = byId[sourceId];
            const target = byId[targetId];
            if (source === undefined || target === undefined) {
              throw new Error("Test graph link references an unknown node");
            }
            const link: GraphLinkLike = { source, target };
            source.forward[targetId] = link;
            target.reverse[sourceId] = link;
            links.push(link);
          }
        }
      },
    };
    const view: GraphViewLike = { renderer };
    view.update = () => renderer.setData(data);
    const leaf = { view: { getViewType: () => "graph", ...view } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    bridge.patchOpenGraphs();

    expect(received?.numLinks).toBe(3);
    expect(renderer.links).toEqual([]);
    expect(data.numLinks).toBe(0);
    bridge.dispose();
    expect(received).toBe(data);
  });

  it("restores a renderer when its graph view closes", () => {
    const originalSetData = vi.fn();
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData: originalSetData,
    };
    const update = vi.fn();
    const leaf = {
      view: {
        getViewType: () => "graph",
        renderer,
        update,
      },
    };
    let leaves = [leaf];
    const app = {
      workspace: { getLeavesOfType: () => leaves },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    bridge.patchOpenGraphs();
    expect(renderer.setData).not.toBe(originalSetData);
    expect(update).toHaveBeenCalledOnce();

    leaves = [];
    bridge.patchOpenGraphs();
    expect(renderer.setData).toBe(originalSetData);
    expect(update).toHaveBeenCalledOnce();
  });

  it("refreshes a newly patched view once during a rebuild", () => {
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData: vi.fn(),
    };
    const update = vi.fn();
    const leaf = {
      view: {
        getViewType: () => "graph",
        renderer,
        update,
      },
    };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    bridge.refreshAll();

    expect(update).toHaveBeenCalledOnce();
  });

  it("loads a deferred graph before patching its renderer", async () => {
    const originalSetData = vi.fn();
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      renderCallback: vi.fn(),
      setData: originalSetData,
    };
    const update = vi.fn();
    const view: GraphViewLike & { getViewType: () => string } = {
      getViewType: () => "graph",
    };
    const leaf = {
      getViewState: () => ({ type: "graph" }),
      loadIfDeferred: vi.fn(() => {
        view.renderer = renderer;
        view.update = update;
        return Promise.resolve();
      }),
      view,
    };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    await bridge.synchronizeAfterWorkspaceChange(leaf as never);

    expect(leaf.loadIfDeferred).toHaveBeenCalledOnce();
    expect(renderer.setData).not.toBe(originalSetData);
    expect(update).toHaveBeenCalledOnce();
  });

  it("does not patch a graph that finishes loading after disposal", async () => {
    const originalSetData = vi.fn();
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData: originalSetData,
    };
    const update = vi.fn();
    const view: GraphViewLike & { getViewType: () => string } = {
      getViewType: () => "graph",
    };
    let finishLoading: (() => void) | undefined;
    const leaf = {
      getViewState: () => ({ type: "graph" }),
      loadIfDeferred: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishLoading = () => {
              view.renderer = renderer;
              view.update = update;
              resolve();
            };
          }),
      ),
      view,
    };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    const patching = bridge.synchronizeAfterWorkspaceChange(leaf as never);
    bridge.dispose();
    finishLoading?.();
    await patching;

    expect(renderer.setData).toBe(originalSetData);
    expect(update).not.toHaveBeenCalled();
  });

  it("attaches a render callback that appears after a graph reopens", async () => {
    const originalRenderCallback = vi.fn();
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData: vi.fn(),
    };
    const update = vi.fn();
    const view = {
      getViewType: () => "graph",
      renderer,
      update,
    };
    const leaf = {
      getViewState: () => ({ type: "graph" }),
      loadIfDeferred: vi.fn(() => Promise.resolve()),
      view,
    };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    let initialized = false;
    const waitForFrame = vi.fn(() => {
      if (!initialized) {
        renderer.renderCallback = originalRenderCallback;
        initialized = true;
      }
      return Promise.resolve();
    });
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
      waitForFrame,
    );

    await bridge.synchronizeAfterWorkspaceChange(leaf as never);

    expect(waitForFrame).toHaveBeenCalledTimes(30);
    expect(renderer.renderCallback).not.toBe(originalRenderCallback);
    renderer.renderCallback?.();
    expect(originalRenderCallback).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("patches a view that becomes a graph after the workspace event", async () => {
    let viewType = "empty";
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      renderCallback: vi.fn(),
      setData: vi.fn(),
    };
    const update = vi.fn();
    const view: GraphViewLike & { getViewType: () => string } = {
      getViewType: () => viewType,
    };
    const leaf = {
      getViewState: () => ({ type: viewType }),
      loadIfDeferred: vi.fn(() => Promise.resolve()),
      view,
    };
    const app = {
      workspace: {
        getLeavesOfType: () => (viewType === "graph" ? [leaf] : []),
      },
    };
    let initialized = false;
    const waitForFrame = vi.fn(() => {
      if (!initialized) {
        viewType = "graph";
        view.renderer = renderer;
        view.update = update;
        initialized = true;
      }
      return Promise.resolve();
    });
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
      waitForFrame,
    );

    await bridge.synchronizeAfterWorkspaceChange(leaf as never);

    expect(leaf.loadIfDeferred).not.toHaveBeenCalled();
    expect(renderer.renderCallback).not.toBeUndefined();
    expect(update).toHaveBeenCalledOnce();
  });

  it("reattaches a render callback replaced during graph initialization", () => {
    const initialRenderCallback = vi.fn();
    const replacementRenderCallback = vi.fn();
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      renderCallback: initialRenderCallback,
      setData: vi.fn(),
    };
    const update = vi.fn();
    const leaf = {
      view: {
        getViewType: () => "graph",
        renderer,
        update,
      },
    };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    bridge.patchOpenGraphs();
    const firstWrapper = renderer.renderCallback;
    renderer.renderCallback = replacementRenderCallback;

    bridge.refreshAll();

    expect(renderer.renderCallback).not.toBe(firstWrapper);
    expect(renderer.renderCallback).not.toBe(replacementRenderCallback);
    renderer.renderCallback();
    expect(replacementRenderCallback).toHaveBeenCalledOnce();

    bridge.dispose();
    expect(renderer.renderCallback).toBe(replacementRenderCallback);
  });

  it("retries contour setup after a transient renderer error", () => {
    const contourLayer = {
      dispose: vi.fn(),
      setGroups: vi.fn(),
      update: vi.fn(),
    };
    const createContourLayer = vi
      .spyOn(FolderContourLayer, "create")
      .mockImplementationOnce(() => {
        throw new Error("Renderer is not ready");
      })
      .mockReturnValue(contourLayer as never);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const data: GraphDataLike = {
      nodes: {
        "folder/a.md": { type: "", links: {} },
        "folder/b.md": { type: "", links: {} },
      },
      numLinks: 0,
    };
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      renderCallback: vi.fn(),
      setData: vi.fn(),
    };
    const view: GraphViewLike = { renderer };
    view.update = () => renderer.setData(data);
    const leaf = { view: { getViewType: () => "graph", ...view } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    try {
      bridge.patchOpenGraphs();
      bridge.refreshAll();

      expect(createContourLayer).toHaveBeenCalledTimes(2);
      expect(contourLayer.setGroups).toHaveBeenCalledOnce();
      expect(contourLayer.update).toHaveBeenCalledOnce();
    } finally {
      bridge.dispose();
      createContourLayer.mockRestore();
      warn.mockRestore();
    }
  });

  it("wraps and restores the native render callback", () => {
    const originalRenderCallback = vi.fn();
    const data: GraphDataLike = {
      nodes: {
        "folder/a.md": { type: "", links: {} },
        "folder/b.md": { type: "", links: {} },
      },
      numLinks: 0,
    };
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      renderCallback: originalRenderCallback,
      setData(next) {
        this.nodes = Object.keys(next.nodes).map((id, index) => ({
          id,
          rendered: true,
          weight: 0,
          x: index * 100,
          y: 0,
        }));
      },
    };
    const view: GraphViewLike = { renderer };
    view.update = () => renderer.setData(data);
    const leaf = { view: { getViewType: () => "graph", ...view } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] },
    };
    const bridge = new NativeGraphBridge(
      app as never,
      () => DEFAULT_TEST_SETTINGS,
    );

    bridge.patchOpenGraphs();

    expect(renderer.renderCallback).not.toBe(originalRenderCallback);
    renderer.renderCallback?.();
    expect(originalRenderCallback).toHaveBeenCalledOnce();

    bridge.dispose();
    expect(renderer.renderCallback).toBe(originalRenderCallback);
  });
});
