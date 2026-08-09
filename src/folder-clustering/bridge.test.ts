import { describe, expect, it, vi } from "vitest";
import { NativeGraphBridge, stripVirtualLinks } from "./bridge";
import { edgeKey } from "./topology";
import type {
  GraphDataLike,
  GraphLinkLike,
  GraphNodeLike,
  GraphRendererLike,
  GraphViewLike
} from "./types";

function node(id: string): GraphNodeLike {
  return { id, forward: {}, reverse: {}, weight: 0 };
}

describe("native graph bridge", () => {
  it("removes virtual foreground links and preserves real ones", () => {
    const a = node("folder/a.md");
    const b = node("folder/b.md");
    const c = node("other/c.md");
    const clearVirtual = vi.fn();
    const virtual = { source: a, target: b, rendered: true, clearGraphics: clearVirtual };
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
      changed
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
      setData: () => undefined
    };
    stripVirtualLinks(renderer, new Set());
    expect(renderer.links).toEqual([link]);
  });

  it("feeds augmented data to the native renderer and strips only its virtual links", () => {
    const data: GraphDataLike = {
      nodes: {
        "folder/a.md": { type: "", links: {} },
        "folder/b.md": { type: "", links: {} },
        "folder/c.md": { type: "", links: {} }
      },
      numLinks: 0
    };
    let received: GraphDataLike | undefined;
    const renderer: GraphRendererLike = {
      links: [],
      nodes: [],
      setData(next) {
        received = next;
        const byId = Object.fromEntries(
          Object.keys(next.nodes).map((id) => [id, node(id)])
        ) as Record<string, GraphNodeLike>;
        this.nodes = Object.values(byId);
        this.links = [];
        for (const [sourceId, sourceData] of Object.entries(next.nodes)) {
          for (const targetId of Object.keys(sourceData.links)) {
            const source = byId[sourceId] as GraphNodeLike;
            const target = byId[targetId] as GraphNodeLike;
            const link: GraphLinkLike = { source, target };
            source.forward[targetId] = link;
            target.reverse[sourceId] = link;
            this.links.push(link);
          }
        }
      }
    };
    const view: GraphViewLike = { renderer };
    view.update = () => renderer.setData(data);
    const leaf = { view: { getViewType: () => "graph", ...view } };
    const app = {
      workspace: { getLeavesOfType: () => [leaf] }
    };
    const bridge = new NativeGraphBridge(app as never, () => 3);

    bridge.patchOpenGraphs();

    expect(received?.numLinks).toBe(3);
    expect(renderer.links).toEqual([]);
    expect(data.numLinks).toBe(0);
    bridge.dispose();
    expect(received).toBe(data);
  });
});
