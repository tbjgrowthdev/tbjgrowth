import { aggregateMetrics, computeDeltas } from "@/lib/seo-experiments/metrics";
import type { ExperimentContentType, ExperimentResults } from "@/lib/seo-experiments/types";

const DAY_MS = 86_400_000;

export interface ChangeImpact {
  results: ExperimentResults;
  isWindowComplete: boolean;
  daysElapsed: number;
  daysRemaining: number;
}

/**
 * Compares performance for `windowDays` immediately before a change against
 * `windowDays` after it, using whatever GSC/GA4 data has been imported so
 * far — the same real-metrics primitive SEO Experiments uses, just anchored
 * to an organic edit instead of an explicit launch. Nothing is persisted:
 * the change itself is already durable as an AuditLog row, so this is
 * recomputed on demand each time it's viewed.
 */
export async function computeChangeImpact(
  contentType: ExperimentContentType,
  contentId: string,
  changedAt: Date,
  windowDays = 28
): Promise<ChangeImpact> {
  const now = new Date();
  const baselineFrom = new Date(changedAt.getTime() - windowDays * DAY_MS);
  const daysElapsed = Math.max(0, Math.floor((now.getTime() - changedAt.getTime()) / DAY_MS));
  const isWindowComplete = daysElapsed >= windowDays;
  const evaluationTo = isWindowComplete ? new Date(changedAt.getTime() + windowDays * DAY_MS) : now;

  const [before, after] = await Promise.all([
    aggregateMetrics(contentType, contentId, baselineFrom, changedAt),
    aggregateMetrics(contentType, contentId, changedAt, evaluationTo),
  ]);

  return {
    results: { before, after, deltas: computeDeltas(before, after) },
    isWindowComplete,
    daysElapsed,
    daysRemaining: Math.max(0, windowDays - daysElapsed),
  };
}
