export type LinkGraphContentType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "OTHER";

export interface LinkGraphNode {
  path: string;
  contentType: LinkGraphContentType;
  title: string;
  topic: string | null;
}

export interface LinkGraphAnchor {
  text: string;
  count: number;
}

export interface LinkGraphEdge {
  sourcePath: string;
  targetPath: string;
  anchors: LinkGraphAnchor[];
  linkCount: number;
}

export interface InternalLinkGraph {
  nodes: LinkGraphNode[];
  edges: LinkGraphEdge[];
}
