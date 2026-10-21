import prisma from "@/lib/prisma";
import type { ExperimentContentType, MetricSnapshot } from "./types";

/**
 * Sums GSC + GA4 rows already imported for this content over [from, to) —
 * both tables already carry contentType/contentId from the import's own
 * content-matching (lib/content-url-mapping.ts), so this is a plain
 * aggregate, not a path-matching exercise. CTR and position are
 * recomputed from the summed totals (impression-weighted), never
 * averaged day-by-day, so a handful of high-volume days don't get diluted
 * by a long tail of near-zero ones.
 */
export async function aggregateMetrics(contentType: ExperimentContentType, contentId: string, from: Date, to: Date): Promise<MetricSnapshot> {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

  const [gscRows, ga4Rows] = await Promise.all([
    prisma.searchConsoleMetric.findMany({
      where: { contentType, contentId, date: { gte: from, lt: to } },
      select: { clicks: true, impressions: true, position: true },
    }),
    prisma.analyticsLandingPageMetric.findMany({
      where: { contentType, contentId, date: { gte: from, lt: to } },
      select: { sessions: true, engagedSessions: true, conversions: true },
    }),
  ]);

  const clicks = gscRows.reduce((sum, r) => sum + r.clicks, 0);
  const impressions = gscRows.reduce((sum, r) => sum + r.impressions, 0);
  const weightedPosition = gscRows.reduce((sum, r) => sum + r.position * r.impressions, 0);

  return {
    days,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedPosition / impressions : null,
    sessions: ga4Rows.reduce((sum, r) => sum + r.sessions, 0),
    engagedSessions: ga4Rows.reduce((sum, r) => sum + r.engagedSessions, 0),
    conversions: ga4Rows.reduce((sum, r) => sum + r.conversions, 0),
  };
}

function pctChange(before: number, after: number): number | null {
  if (before === 0) return after === 0 ? 0 : null; // no baseline to compare against — not "infinite% up"
  return ((after - before) / before) * 100;
}

export function computeDeltas(before: MetricSnapshot, after: MetricSnapshot) {
  return {
    clicksPct: pctChange(before.clicks, after.clicks),
    impressionsPct: pctChange(before.impressions, after.impressions),
    ctrPct: pctChange(before.ctr, after.ctr),
    positionChange: before.position != null && after.position != null ? after.position - before.position : null,
    sessionsPct: pctChange(before.sessions, after.sessions),
    conversionsPct: pctChange(before.conversions, after.conversions),
  };
}
