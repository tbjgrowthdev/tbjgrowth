export type ExperimentContentType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";

export type ExperimentVariable = "TITLE" | "META_DESCRIPTION" | "CTA" | "INTERNAL_LINKS" | "CONTENT_SECTION";

export type ExperimentField = "metaTitle" | "metaDescription" | "content";

// TITLE/META_DESCRIPTION target the matching SEO field directly; CTA,
// INTERNAL_LINKS and CONTENT_SECTION are all really "a change somewhere in
// the body" — the variable name is how the admin labels *why* they're
// testing, not a distinct storage mechanism.
export const VARIABLE_FIELD: Record<ExperimentVariable, ExperimentField> = {
  TITLE: "metaTitle",
  META_DESCRIPTION: "metaDescription",
  CTA: "content",
  INTERNAL_LINKS: "content",
  CONTENT_SECTION: "content",
};

export interface MetricSnapshot {
  days: number;
  clicks: number;
  impressions: number;
  ctr: number; // recomputed from the summed clicks/impressions, not averaged
  position: number | null; // impression-weighted average; null when there were no impressions
  sessions: number;
  engagedSessions: number;
  conversions: number;
}

export interface ExperimentResults {
  before: MetricSnapshot;
  after: MetricSnapshot;
  deltas: {
    clicksPct: number | null;
    impressionsPct: number | null;
    ctrPct: number | null;
    positionChange: number | null; // negative = improved (moved up the results page)
    sessionsPct: number | null;
    conversionsPct: number | null;
  };
}
