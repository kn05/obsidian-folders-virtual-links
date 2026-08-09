export type TopologyDegree = 3 | 4;
export type FolderDepth = "direct" | number;

export interface FolderVirtualLinksSettings {
  excludedFolders: string[];
  folderDepth: FolderDepth;
  showFolderContours: boolean;
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
  circle?: unknown;
  id: string;
  forward?: Record<string, GraphLinkLike>;
  rendered?: boolean;
  reverse?: Record<string, GraphLinkLike>;
  text?: unknown;
  weight: number;
  x?: number;
  y?: number;
}

export interface GraphLinkLike {
  source?: GraphNodeLike;
  target?: GraphNodeLike;
  rendered?: boolean;
  clearGraphics?: () => void;
}

export interface GraphRendererLike {
  hanger?: {
    addChildAt: (child: unknown, index: number) => unknown;
    removeChild: (child: unknown) => unknown;
  };
  links?: GraphLinkLike[];
  nodeLookup?: Record<string, GraphNodeLike>;
  nodes?: GraphNodeLike[];
  renderCallback?: () => unknown;
  setData: (data: GraphDataLike) => unknown;
  changed?: () => void;
}

export interface GraphViewLike {
  renderer?: GraphRendererLike;
  update?: () => void;
  dataEngine?: { render?: () => void };
}
