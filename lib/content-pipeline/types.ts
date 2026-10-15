import type { ContentType, PipelineStage } from "@/lib/generated/prisma/client";

export type PipelineContentType = Extract<ContentType, "POST" | "CASE_STUDY">;

// The order the wizard walks a run through. `stage` on ContentPipelineRun is
// the last one completed; "next" is always PIPELINE_STAGE_ORDER[index(stage) + 1].
export const PIPELINE_STAGE_ORDER: PipelineStage[] = [
  "BRIEF",
  "SEARCH_INTENT",
  "RESEARCH",
  "OUTLINE",
  "DRAFT",
  "SEO",
  "INTERNAL_LINKS",
  "SCHEMA",
  "QA",
  "APPROVAL",
  "PUBLISHED",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  BRIEF: "Brief",
  SEARCH_INTENT: "Search Intent",
  RESEARCH: "Research",
  OUTLINE: "Outline",
  DRAFT: "Draft",
  SEO: "SEO",
  INTERNAL_LINKS: "Internal Links",
  SCHEMA: "Schema",
  QA: "QA",
  APPROVAL: "Human Approval",
  PUBLISHED: "Publish",
};

export function nextStage(stage: PipelineStage): PipelineStage | null {
  const i = PIPELINE_STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < PIPELINE_STAGE_ORDER.length - 1 ? PIPELINE_STAGE_ORDER[i + 1] : null;
}

export interface Brief {
  contentType: PipelineContentType;
  topic: string;
  goal: string;
  audience: string;
  tone: string;
  notes?: string;
  // CASE_STUDY only — these three are required (non-nullable) columns on
  // the CaseStudy model itself, so they're collected up front.
  clientName?: string;
  industry?: string;
  serviceType?: string;
  resultsHint?: string;
}

export interface SearchIntentKeyword {
  keyword: string;
  searchVolume: number | null;
  competition: number | null;
  cpc: number | null;
}

export interface SearchIntent {
  intentType: "informational" | "commercial" | "transactional" | "navigational";
  rationale: string;
  primaryKeyword: string;
  secondaryKeywords: SearchIntentKeyword[];
}

export type RagSourceType = "PAGE" | "SERVICE" | "CASE_STUDY" | "FAQ" | "BRAND_DOC" | "POST";

export interface RetrievedSource {
  sourceType: RagSourceType;
  title: string;
  excerpt: string;
  url: string | null;
  score: number;
}

export interface Research {
  commonThemes: string[];
  contentGaps: string[];
  questionsToAnswer: string[];
  competitorUrls: string[];
  // Approved internal sources (lib/rag/retrieve.ts) relevant to the brief —
  // computed in code, not model output, and merged in after the AI call
  // (see runResearchStage). Carried forward on the Research object so
  // buildDraftPrompt can ground the actual writing in them too, without a
  // second retrieval call.
  retrievedSources: RetrievedSource[];
}

export interface OutlineSection {
  heading: string;
  level: "h2" | "h3";
  summary: string;
  bullets: string[];
}

export interface Outline {
  title: string;
  excerpt: string;
  sections: OutlineSection[];
}

export interface AppliedInternalLink {
  anchorText: string;
  targetUrl: string;
  targetTitle: string;
  applied: boolean;
  reason?: string; // set when applied is false (anchor text not found verbatim in the draft)
}

export interface SchemaNotes {
  schemaType: string;
  notes?: string;
}

export interface QaCheck {
  label: string;
  passed: boolean;
  note?: string;
}

export interface QaReport {
  overallPassed: boolean;
  wordCount: number;
  checks: QaCheck[];
  summary: string;
}
