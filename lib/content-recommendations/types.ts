export type GapSource = "gsc_query" | "tracked_keyword";

export interface RecommendationCandidate {
  keyword: string;
  topic: string;
  suggestedFormat: string;
  contentType: "POST" | "CASE_STUDY";
  priorityScore: number;
  reasoning: string;
  source: GapSource;
}

export const FORMAT_LABEL = {
  HOW_TO: "How-To Guide",
  LISTICLE: "Listicle",
  COMPARISON: "Comparison",
  EXPLAINER: "Explainer",
  CASE_STUDY: "Case Study",
  STANDARD: "Standard Post",
} as const;
