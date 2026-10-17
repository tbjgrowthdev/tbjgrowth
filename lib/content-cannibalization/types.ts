export type CannibalizationActionType = "MERGE" | "DIFFERENTIATE" | "REDIRECT" | "RETARGET";

export interface SharedQuery {
  query: string;
  impressionsA: number;
  impressionsB: number;
}

export interface CannibalizationCandidate {
  contentTypeA: "POST" | "CASE_STUDY";
  contentIdA: string;
  contentTypeB: "POST" | "CASE_STUDY";
  contentIdB: string;
  similarity: number;
  sharedQueries: SharedQuery[];
  suggestedAction: CannibalizationActionType;
  reasoning: string;
}

export const ACTION_LABEL: Record<CannibalizationActionType, string> = {
  MERGE: "Merge",
  DIFFERENTIATE: "Differentiate",
  REDIRECT: "Redirect",
  RETARGET: "Retarget",
};

// Shown next to the suggested action in the admin UI — none of these are
// ever carried out by the system itself; each links to the existing admin
// area where a human would actually do the work by hand.
export const ACTION_EXPLANATION: Record<CannibalizationActionType, string> = {
  MERGE: "Near-duplicate content and both pages carry real traffic — combine them into one stronger page, then redirect the other from the Redirects manager.",
  DIFFERENTIATE: "The content overlaps too much to coexist as-is, but there's no strong evidence Google is actually confusing them yet — rewrite each to cover a genuinely distinct angle before it becomes one.",
  REDIRECT: "Near-duplicate content and one page is carrying almost all the traffic already — 301 the weaker one to the stronger one from the Redirects manager.",
  RETARGET: "The content itself isn't very similar, but Search Console shows both pages competing for the same query — re-point each page's focus keyword so they stop chasing the same term.",
};
