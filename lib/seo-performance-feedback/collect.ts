import { scanForCannibalizationPairs } from "@/lib/content-cannibalization/detect";
import { scanForRefreshCandidates } from "@/lib/content-refresh/detect";
import type { RefreshSignalType } from "@/lib/content-refresh/types";
import type { PerformanceFeedbackCandidate, PerformanceSignal, PerformanceSignalType } from "./types";

// OLD_CONTENT and OUTDATED_MENTION are both "this page is stale," which the
// spec driving this feature groups as one umbrella signal — Content Decay
// — distinct from the three live performance-decline signals they sit
// alongside in ContentRefresh.
const DECAY_TYPES: RefreshSignalType[] = ["OLD_CONTENT", "OUTDATED_MENTION"];

function mapRefreshSignalType(type: RefreshSignalType): PerformanceSignalType {
  return DECAY_TYPES.includes(type) ? "CONTENT_DECAY" : (type as PerformanceSignalType);
}

function key(contentType: string, contentId: string): string {
  return `${contentType}:${contentId}`;
}

/**
 * Merges two already-existing, independently-run detectors into one
 * signal list per piece of content — ContentRefresh's decline/decay scan
 * (ranking, CTR, traffic, conversion decline, and content decay) and
 * ContentCannibalization's pairwise scan (attached to both pages in a
 * pair). Nothing here re-fetches GSC/GA4 data itself; every signal's
 * `detail` string already carries the concrete numbers those scans pulled.
 * Read-only, same as the two scans it calls.
 */
export async function collectPerformanceSignals(): Promise<PerformanceFeedbackCandidate[]> {
  const [refreshCandidates, cannibalizationPairs] = await Promise.all([scanForRefreshCandidates(), scanForCannibalizationPairs()]);

  const byKey = new Map<string, PerformanceFeedbackCandidate>();

  for (const c of refreshCandidates) {
    byKey.set(key(c.contentType, c.contentId), {
      contentType: c.contentType,
      contentId: c.contentId,
      signals: c.signals.map((s): PerformanceSignal => ({ type: mapRefreshSignalType(s.type), detail: s.detail })),
    });
  }

  for (const pair of cannibalizationPairs) {
    const sides: [typeof pair.contentTypeA, string][] = [
      [pair.contentTypeA, pair.contentIdA],
      [pair.contentTypeB, pair.contentIdB],
    ];
    for (const [contentType, contentId] of sides) {
      const signal: PerformanceSignal = { type: "CANNIBALIZATION", detail: pair.reasoning };
      const k = key(contentType, contentId);
      const existing = byKey.get(k);
      if (existing) existing.signals.push(signal);
      else byKey.set(k, { contentType, contentId, signals: [signal] });
    }
  }

  return Array.from(byKey.values());
}
