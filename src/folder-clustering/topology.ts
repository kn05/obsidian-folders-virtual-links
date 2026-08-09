import { TOPOLOGY_ATTEMPTS } from "./constants";
import type { TopologyDegree, VirtualEdge } from "./types";

const EDGE_SEPARATOR = "\u0000";

export function edgeKey(left: string, right: string): string {
  return left < right
    ? `${left}${EDGE_SEPARATOR}${right}`
    : `${right}${EDGE_SEPARATOR}${left}`;
}

function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function compareBySalt(left: string, right: string, salt: string): number {
  const hashDifference = hash32(`${salt}:${left}`) - hash32(`${salt}:${right}`);
  return hashDifference || left.localeCompare(right);
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function shuffled<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  const random = createRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = value as T;
  }
  return result;
}

function addEdge(
  edges: VirtualEdge[],
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string,
): boolean {
  if (source === target || adjacency.get(source)?.has(target)) return false;
  adjacency.get(source)?.add(target);
  adjacency.get(target)?.add(source);
  edges.push({ source, target });
  return true;
}

function clique(paths: readonly string[]): VirtualEdge[] {
  const edges: VirtualEdge[] = [];
  for (let left = 0; left < paths.length; left += 1) {
    const source = paths[left];
    if (source === undefined) continue;

    for (const target of paths.slice(left + 1)) {
      edges.push({ source, target });
    }
  }
  return edges;
}

function makeStubs(
  paths: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  targetDegree: number,
  parityNode: string | undefined,
): string[] {
  const stubs: string[] = [];
  for (const path of paths) {
    const goal = targetDegree + (path === parityNode ? 1 : 0);
    const deficit = goal - (adjacency.get(path)?.size ?? 0);
    for (let count = 0; count < deficit; count += 1) stubs.push(path);
  }
  return stubs;
}

function tryBuildStubEdges(
  baseAdjacency: ReadonlyMap<string, ReadonlySet<string>>,
  stubs: readonly string[],
  seed: number,
): VirtualEdge[] | undefined {
  const candidateAdjacency = new Map<string, Set<string>>();
  for (const [path, neighbors] of baseAdjacency) {
    candidateAdjacency.set(path, new Set(neighbors));
  }

  const candidateEdges: VirtualEdge[] = [];
  const candidates = shuffled(stubs, seed);
  for (let index = 0; index < candidates.length; index += 2) {
    const source = candidates[index];
    const target = candidates[index + 1];
    if (source === undefined || target === undefined) return undefined;
    if (!addEdge(candidateEdges, candidateAdjacency, source, target))
      return undefined;
  }

  return candidateEdges;
}

export function buildFolderTopology(
  memberPaths: readonly string[],
  requestedDegree: TopologyDegree,
  folderSeed: string,
): VirtualEdge[] {
  const paths = [...new Set(memberPaths)].sort((left, right) =>
    compareBySalt(left, right, `${folderSeed}:cycle`),
  );
  const nodeCount = paths.length;
  if (nodeCount < 2) return [];

  const targetDegree = Math.min(requestedDegree, nodeCount - 1);
  if (targetDegree === nodeCount - 1) return clique(paths);

  const adjacency = new Map(paths.map((path) => [path, new Set<string>()]));
  const edges: VirtualEdge[] = [];
  for (const [index, source] of paths.entries()) {
    const target = paths[(index + 1) % nodeCount];
    if (target !== undefined) addEdge(edges, adjacency, source, target);
  }
  if (targetDegree <= 2) return edges;

  const needsParityNode = (nodeCount * targetDegree) % 2 === 1;
  const parityNode = needsParityNode ? paths[0] : undefined;
  const stubs = makeStubs(paths, adjacency, targetDegree, parityNode);

  for (let attempt = 0; attempt < TOPOLOGY_ATTEMPTS; attempt += 1) {
    const attemptSeed = hash32(`${folderSeed}:matching:${String(attempt)}`);
    const stubEdges = tryBuildStubEdges(adjacency, stubs, attemptSeed);
    if (stubEdges !== undefined) return edges.concat(stubEdges);
  }

  throw new Error(`Could not build folder topology: ${folderSeed}`);
}
