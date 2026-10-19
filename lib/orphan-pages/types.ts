export type LinkStrength = "orphan" | "weak";

export interface LinkSuggestion {
  sourceContentType: "POST" | "CASE_STUDY";
  sourceContentId: string;
  sourceTitle: string;
  sourcePath: string;
  anchor: string;
  context: string;
  similarity: number;
}

export interface OrphanPageCandidate {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  title: string;
  path: string;
  inboundLinkCount: number;
  strength: LinkStrength;
  suggestions: LinkSuggestion[];
}
