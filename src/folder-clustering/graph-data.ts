import { buildFolderTopology, edgeKey } from "./topology";
import type { GraphDataLike, GraphNodeDataLike, TopologyDegree } from "./types";

export interface AugmentedGraphData {
  data: GraphDataLike;
  virtualEdgeKeys: Set<string>;
}

export function directParent(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator < 0 ? "" : path.slice(0, separator);
}

function markdownFolders(nodes: Readonly<Record<string, GraphNodeDataLike>>): Map<string, string[]> {
  const folders = new Map<string, string[]>();
  for (const [path, node] of Object.entries(nodes)) {
    if (node.type !== "") continue;
    const folder = directParent(path);
    const members = folders.get(folder) ?? [];
    members.push(path);
    folders.set(folder, members);
  }
  return folders;
}

function hasLink(data: GraphDataLike, source: string, target: string): boolean {
  return data.nodes[source]?.links[target] === true || data.nodes[target]?.links[source] === true;
}

export function augmentGraphData(
  original: GraphDataLike,
  topologyDegree: TopologyDegree
): AugmentedGraphData {
  const nodes = { ...original.nodes };
  const clonedSources = new Set<string>();
  const virtualEdgeKeys = new Set<string>();
  let addedLinks = 0;

  const folders = [...markdownFolders(original.nodes)].sort(([left], [right]) =>
    left.localeCompare(right)
  );

  for (const [folder, members] of folders) {
    for (const edge of buildFolderTopology(members, topologyDegree, folder || "<root>")) {
      if (hasLink(original, edge.source, edge.target)) continue;

      if (!clonedSources.has(edge.source)) {
        const sourceNode = original.nodes[edge.source];
        if (sourceNode === undefined) continue;
        nodes[edge.source] = { ...sourceNode, links: { ...sourceNode.links } };
        clonedSources.add(edge.source);
      }

      const sourceNode = nodes[edge.source];
      if (sourceNode === undefined || sourceNode.links[edge.target] === true) continue;
      sourceNode.links[edge.target] = true;
      virtualEdgeKeys.add(edgeKey(edge.source, edge.target));
      addedLinks += 1;
    }
  }

  return {
    data: addedLinks === 0 ? original : { ...original, nodes, numLinks: original.numLinks + addedLinks },
    virtualEdgeKeys
  };
}
