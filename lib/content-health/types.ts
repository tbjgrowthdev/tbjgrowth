export type HealthFactorKey = "freshness" | "traffic" | "ranking" | "ctr" | "internalLinks" | "seoCompleteness" | "searchIntent" | "conversion";

export interface FactorScore {
  factor: HealthFactorKey;
  score: number | null; // null = no data available for this page — excluded from the overall average, not counted as 0
  detail: string;
}

export type HealthGrade = "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "POOR";

export interface ContentHealthResult {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  overallScore: number;
  grade: HealthGrade;
  factors: FactorScore[];
}

export const FACTOR_LABEL: Record<HealthFactorKey, string> = {
  freshness: "Freshness",
  traffic: "Traffic",
  ranking: "Ranking",
  ctr: "CTR",
  internalLinks: "Internal Links",
  seoCompleteness: "SEO Completeness",
  searchIntent: "Search Intent",
  conversion: "Conversion",
};

export const GRADE_LABEL: Record<HealthGrade, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  NEEDS_ATTENTION: "Needs Attention",
  POOR: "Poor",
};

export function gradeFromScore(score: number): HealthGrade {
  if (score >= 80) return "EXCELLENT";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "NEEDS_ATTENTION";
  return "POOR";
}
