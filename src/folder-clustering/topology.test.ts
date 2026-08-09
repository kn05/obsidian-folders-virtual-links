import { describe, expect, it } from "vitest";
import { buildFolderTopology, edgeKey } from "./topology";
import type { TopologyDegree, VirtualEdge } from "./types";

function paths(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `folder/note-${String(index)}.md`,
  );
}

function degrees(
  nodes: readonly string[],
  edges: readonly VirtualEdge[],
): Map<string, number> {
  const result = new Map(nodes.map((node) => [node, 0]));
  for (const edge of edges) {
    result.set(edge.source, (result.get(edge.source) ?? 0) + 1);
    result.set(edge.target, (result.get(edge.target) ?? 0) + 1);
  }
  return result;
}

function isConnected(
  nodes: readonly string[],
  edges: readonly VirtualEdge[],
): boolean {
  const firstNode = nodes[0];
  if (firstNode === undefined) return true;
  const adjacency = new Map(nodes.map((node) => [node, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const visited = new Set<string>();
  const pending = [firstNode];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (visited.has(node)) continue;
    visited.add(node);
    pending.push(...(adjacency.get(node) ?? []));
  }
  return visited.size === nodes.length;
}

function diameter(
  nodes: readonly string[],
  edges: readonly VirtualEdge[],
): number {
  const adjacency = new Map(nodes.map((node) => [node, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  let result = 0;
  for (const start of nodes) {
    const distances = new Map([[start, 0]]);
    const pending = [start];
    let index = 0;
    while (index < pending.length) {
      const current = pending[index];
      index += 1;
      if (current === undefined) continue;
      const nextDistance = (distances.get(current) ?? 0) + 1;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, nextDistance);
        pending.push(neighbor);
        result = Math.max(result, nextDistance);
      }
    }
  }
  return result;
}

describe("folder topology", () => {
  it.each([3, 4] satisfies TopologyDegree[])(
    "builds deterministic, connected degree-%s graphs",
    (degree) => {
      for (let count = 2; count <= 80; count += 1) {
        const nodes = paths(count);
        const first = buildFolderTopology(nodes, degree, "folder");
        const second = buildFolderTopology(
          [...nodes].reverse(),
          degree,
          "folder",
        );
        const keys = first.map((edge) => edgeKey(edge.source, edge.target));

        expect(second).toEqual(first);
        expect(new Set(keys).size).toBe(first.length);
        expect(first.every((edge) => edge.source !== edge.target)).toBe(true);
        expect(isConnected(nodes, first)).toBe(true);

        const values = [...degrees(nodes, first).values()];
        const expected = Math.min(degree, count - 1);
        expect(Math.min(...values)).toBe(expected);
        expect(Math.max(...values)).toBeLessThanOrEqual(
          Math.min(expected + 1, count - 1),
        );
      }
    },
  );

  it("uses linear edge growth for vault-sized folders", () => {
    const nodes = paths(1_000);
    const edges = buildFolderTopology(nodes, 3, "large-folder");
    expect(edges.length).toBe(1_500);
  });

  it("gives the largest current-vault folder shorter paths than a plain ring", () => {
    const nodes = paths(29);
    const edges = buildFolderTopology(
      nodes,
      3,
      "10_Mathematics/11_Linear Algebra",
    );
    expect(diameter(nodes, edges)).toBeLessThan(Math.floor(nodes.length / 2));
  });
});
