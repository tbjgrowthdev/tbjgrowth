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
  "IMAGE",
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
  IMAGE: "Image",
  SEO: "SEO",
  INTERNAL_LINKS: "Internal Links",
  SCHEMA: "Schema",
  QA: "Quality Gate",
  APPROVAL: "Human Approval",
  PUBLISHED: "Publish",
  // Not a real pipeline stage (never appears in PIPELINE_STAGE_ORDER) —
  // only a tag for AiJob rows that belong to a ContentRefresh cycle
  // instead of a ContentPipelineRun. See lib/content-refresh/.
  REFRESH: "Content Refresh",
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

// "invalid" = failed server-side validation (anchor text not found
// verbatim, or an invented/duplicate target URL) before a human ever sees
// it — distinct from "rejected," which is an editor's own decision on a
// suggestion that was perfectly valid. Only "pending" suggestions are
// ever shown to an editor for a decision; "invalid" ones are shown
// read-only, for transparency, with invalidReason explaining why the AI's
// suggestion was discarded automatically.
export type LinkSuggestionStatus = "pending" | "approved" | "rejected" | "invalid";

// sourceTitle is this run's own content — constant across every
// suggestion in this implementation (outbound links only: FROM the new
// draft TO existing published content). Kept as its own field, not
// inferred from context, so the review table always shows Source/Target/
// Anchor/Reason as four real columns — the shape a future suggestion
// engine that also proposes inbound links (FROM existing published
// content TO this one) could use without a breaking type change, though
// building that is explicitly out of scope here: it would mean an AI
// editing already-published content, a materially bigger and riskier
// feature than suggesting links for a brand-new draft.
export interface LinkSuggestion {
  id: string;
  sourceTitle: string;
  targetTitle: string;
  targetUrl: string;
  anchorText: string;
  reason: string;
  status: LinkSuggestionStatus;
  invalidReason?: string;
  // True only once an "approved" suggestion has actually been inserted
  // into the content by applyInternalLinks — approving alone never
  // touches the content; applying (after every suggestion has a
  // decision) does.
  applied: boolean;
}

// The pending-review state for the IMAGE stage — see
// lib/content-pipeline/stages.ts's runImageStage/attachGeneratedImage.
// `approved` only ever flips via attachGeneratedImage, which writes
// featuredImage/featuredImageAlt onto the real content row in the same
// action — there's no "approved but not yet attached" state.
export interface GeneratedImage {
  mediaAssetId: string;
  url: string;
  altText: string;
  provider: string;
  model: string;
  approved: boolean;
  approvedAt?: string;
  approvedById?: string;
}

export interface SchemaNotes {
  schemaType: string;
  notes?: string;
}

// The ten named categories the Quality Gate checks before publish —
// exactly the taxonomy the stage is specced against, so the wizard can
// group checks under the same headings rather than a flat list.
export type QaCategory =
  | "Duplicate Content"
  | "Brand Voice"
  | "SEO"
  | "Search Intent"
  | "Facts"
  | "Links"
  | "Schema"
  | "Metadata"
  | "Alt Text"
  | "Quality";

export interface QaCheck {
  category: QaCategory;
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
