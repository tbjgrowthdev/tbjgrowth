export type PerformanceSignalType = "RANKING_DECLINE" | "CTR_DECLINE" | "TRAFFIC_DECLINE" | "CONVERSION_DECLINE" | "CONTENT_DECAY" | "CANNIBALIZATION";

export interface PerformanceSignal {
  type: PerformanceSignalType;
  detail: string;
}

export interface PerformanceFeedbackCandidate {
  contentType: "POST" | "CASE_STUDY";
  contentId: string;
  signals: PerformanceSignal[];
}

export const SIGNAL_LABEL: Record<PerformanceSignalType, string> = {
  RANKING_DECLINE: "Ranking decline",
  CTR_DECLINE: "CTR decline",
  TRAFFIC_DECLINE: "Traffic decline",
  CONVERSION_DECLINE: "Conversion decline",
  CONTENT_DECAY: "Content decay",
  CANNIBALIZATION: "Cannibalization",
};

export type PerformanceFeedbackSeverity = "HIGH" | "MEDIUM" | "LOW";

// Revenue-adjacent signals (conversion, ranking, cannibalization) weigh
// more than leading indicators (CTR, decay) — same "starting point, not
// tuned against real outcomes" caveat as every other threshold introduced
// this way in this codebase.
const SIGNAL_WEIGHT: Record<PerformanceSignalType, number> = {
  CONVERSION_DECLINE: 3,
  RANKING_DECLINE: 3,
  CANNIBALIZATION: 3,
  TRAFFIC_DECLINE: 2,
  CTR_DECLINE: 1,
  CONTENT_DECAY: 1,
};

export function deriveSeverity(signals: PerformanceSignal[]): PerformanceFeedbackSeverity {
  const score = signals.reduce((sum, s) => sum + SIGNAL_WEIGHT[s.type], 0);
  if (score >= 5) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
}
