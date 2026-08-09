export type TopologyDegree = 3 | 4;
export type FolderDepth = "direct" | number;

export interface FolderVirtualLinksSettings {
  excludedFolders: string[];
  folderDepth: FolderDepth;
  topologyDegree: TopologyDegree;
}

export interface VirtualEdge {
  source: string;
  target: string;
}

export interface GraphNodeDataLike {
  color?: unknown;
  links: Record<string, boolean>;
  type: string;
}

export interface GraphDataLike {
  nodes: Record<string, GraphNodeDataLike>;
  numLinks: number;
}

export interface GraphNodeLike {
  id: string;
  forward?: Record<string, GraphLinkLike>;
  reverse?: Record<string, GraphLinkLike>;
  weight: number;
}

export interface GraphLinkLike {
  source?: GraphNodeLike;
  target?: GraphNodeLike;
  rendered?: boolean;
  clearGraphics?: () => void;
}

export interface GraphRendererLike {
  links?: GraphLinkLike[];
  nodes?: GraphNodeLike[];
  setData: (data: GraphDataLike) => unknown;
  changed?: () => void;
}

export interface GraphViewLike {
  renderer?: GraphRendererLike;
  update?: () => void;
  dataEngine?: { render?: () => void };
}
