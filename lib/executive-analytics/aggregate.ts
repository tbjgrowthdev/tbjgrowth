import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { parseUrlPath } from "@/lib/content-url-mapping";
import { getCostSummary } from "@/lib/content-pipeline/costs";
import { getLatestSeoAuditRun } from "@/lib/seo-audits/run";
import type { DailyPoint, ExecutiveAnalyticsData, MarketPerformanceRow, TopPageRow } from "./types";

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toSeries(map: Map<string, number>): DailyPoint[] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

function slugFromLocationPath(path: string): string | null {
  const match = path.match(/\/locations\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

/**
 * Executive Analytics is a pure rollup: it reads tables every other feature
 * already populates (SearchConsoleMetric/AnalyticsLandingPageMetric from the
 * GSC/GA4 imports, ContentHealthScore, SeoAuditRun, AiJob, ContentRefresh,
 * Location) and reuses getCostSummary() for AI cost. No new writes, no new
 * models. Gated by SETTINGS_MANAGEMENT (ADMIN/SUPER_ADMIN only), same tier
 * as Settings/Monitoring/Brand KB, since it's a business-wide rollup rather
 * than a single team's working tool.
 */
export async function getExecutiveAnalytics(days: number = 30): Promise<ExecutiveAnalyticsData | null> {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - days);
  const dateWindow = { gte: windowStart, lte: windowEnd };

  const [
    gscTotals,
    gscByPage,
    gscByQuery,
    gscByDay,
    gscByLocationPage,
    ga4Totals,
    ga4ByLandingPage,
    ga4ByDay,
    ga4ByLocationPage,
    formSubmissions,
    formSubmissionsByDay,
    bookings,
    bookingsByDay,
    healthScores,
    seoAuditRun,
    aiJobs,
    [postCount, pageCount, caseStudyCount],
    pipelineRunsCompleted,
    refreshByStatus,
    locations,
    costSummary,
  ] = await Promise.all([
    prisma.searchConsoleMetric.aggregate({
      where: { date: dateWindow },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    prisma.searchConsoleMetric.groupBy({
      by: ["page"],
      where: { date: dateWindow },
      _sum: { clicks: true, impressions: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 15,
    }),
    prisma.searchConsoleMetric.groupBy({
      by: ["query"],
      where: { date: dateWindow },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: 10,
    }),
    prisma.searchConsoleMetric.groupBy({
      by: ["date"],
      where: { date: dateWindow },
      _sum: { clicks: true },
    }),
    prisma.searchConsoleMetric.groupBy({
      by: ["page"],
      where: { date: dateWindow, page: { contains: "/locations/" } },
      _sum: { clicks: true, impressions: true },
    }),
    prisma.analyticsLandingPageMetric.aggregate({
      where: { date: dateWindow },
      _sum: { sessions: true, conversions: true },
    }),
    prisma.analyticsLandingPageMetric.groupBy({
      by: ["landingPage"],
      where: { date: dateWindow },
      _sum: { sessions: true },
    }),
    prisma.analyticsLandingPageMetric.groupBy({
      by: ["date"],
      where: { date: dateWindow },
      _sum: { sessions: true },
    }),
    prisma.analyticsLandingPageMetric.groupBy({
      by: ["landingPage"],
      where: { date: dateWindow, landingPage: { contains: "/locations/" } },
      _sum: { sessions: true, conversions: true },
    }),
    prisma.formSubmission.count({ where: { createdAt: dateWindow } }),
    prisma.formSubmission.findMany({ where: { createdAt: dateWindow }, select: { createdAt: true } }),
    prisma.booking.count({ where: { status: "CONFIRMED", createdAt: dateWindow } }),
    prisma.booking.findMany({ where: { status: "CONFIRMED", createdAt: dateWindow }, select: { createdAt: true } }),
    prisma.contentHealthScore.findMany({ select: { grade: true, overallScore: true } }),
    getLatestSeoAuditRun(),
    prisma.aiJob.findMany({ where: { queuedAt: dateWindow }, select: { status: true, stage: true } }),
    prisma.$transaction([
      prisma.post.count({ where: { status: "PUBLISHED", publishedAt: dateWindow } }),
      prisma.page.count({ where: { status: "PUBLISHED", publishedAt: dateWindow } }),
      prisma.caseStudy.count({ where: { status: "PUBLISHED", publishedAt: dateWindow } }),
    ]),
    prisma.contentPipelineRun.count({ where: { stage: "PUBLISHED", updatedAt: dateWindow } }),
    prisma.contentRefresh.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.location.findMany({ select: { slug: true, market: true } }),
    getCostSummary(),
  ]);

  // --- Organic traffic: GSC clicks/impressions/position + GA4 sessions, as one trend ---
  const dailyClicksMap = new Map<string, number>();
  for (const row of gscByDay) dailyClicksMap.set(dateKey(row.date), row._sum.clicks ?? 0);
  const dailySessionsMap = new Map<string, number>();
  for (const row of ga4ByDay) dailySessionsMap.set(dateKey(row.date), row._sum.sessions ?? 0);

  // --- Leads: daily count of form submissions + confirmed bookings together ---
  const dailyLeadsMap = new Map<string, number>();
  for (const f of formSubmissionsByDay) {
    const key = dateKey(f.createdAt);
    dailyLeadsMap.set(key, (dailyLeadsMap.get(key) ?? 0) + 1);
  }
  for (const b of bookingsByDay) {
    const key = dateKey(b.createdAt);
    dailyLeadsMap.set(key, (dailyLeadsMap.get(key) ?? 0) + 1);
  }

  // --- Top pages: merge GSC clicks + GA4 sessions by normalized path ---
  const pageMap = new Map<string, TopPageRow>();
  for (const row of gscByPage) {
    const path = parseUrlPath(row.page);
    const entry = pageMap.get(path) ?? { path, clicks: 0, impressions: 0, sessions: 0 };
    entry.clicks += row._sum.clicks ?? 0;
    entry.impressions += row._sum.impressions ?? 0;
    pageMap.set(path, entry);
  }
  for (const row of ga4ByLandingPage) {
    const entry = pageMap.get(row.landingPage) ?? { path: row.landingPage, clicks: 0, impressions: 0, sessions: 0 };
    entry.sessions += row._sum.sessions ?? 0;
    pageMap.set(row.landingPage, entry);
  }
  const topPages = [...pageMap.values()].sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions)).slice(0, 10);

  const topKeywords = gscByQuery.map((g) => ({
    query: g.query,
    clicks: g._sum.clicks ?? 0,
    impressions: g._sum.impressions ?? 0,
    position: g._avg.position ?? 0,
  }));

  // --- Content performance ---
  const byGrade: Record<string, number> = {};
  let scoreSum = 0;
  for (const h of healthScores) {
    byGrade[h.grade] = (byGrade[h.grade] ?? 0) + 1;
    scoreSum += h.overallScore;
  }

  // --- AI usage ---
  const byStatus: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const j of aiJobs) {
    byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    byStage[j.stage] = (byStage[j.stage] ?? 0) + 1;
  }

  // --- Refresh opportunities ---
  const refreshStatusCounts: Record<string, number> = {};
  for (const r of refreshByStatus) refreshStatusCounts[r.status] = r._count._all;

  // --- Market performance: Location pages' GSC/GA4 rows grouped by Location.market ---
  const marketByLocationSlug = new Map(locations.map((l) => [l.slug, l.market]));
  const marketTotals = new Map<string, MarketPerformanceRow>();
  for (const l of locations) {
    if (!marketTotals.has(l.market)) {
      marketTotals.set(l.market, { market: l.market, locationCount: 0, clicks: 0, impressions: 0, sessions: 0, conversions: 0 });
    }
    marketTotals.get(l.market)!.locationCount += 1;
  }
  for (const row of gscByLocationPage) {
    const slug = slugFromLocationPath(parseUrlPath(row.page));
    const market = slug ? marketByLocationSlug.get(slug) : undefined;
    if (!market) continue;
    const entry = marketTotals.get(market)!;
    entry.clicks += row._sum.clicks ?? 0;
    entry.impressions += row._sum.impressions ?? 0;
  }
  for (const row of ga4ByLocationPage) {
    const slug = slugFromLocationPath(row.landingPage);
    const market = slug ? marketByLocationSlug.get(slug) : undefined;
    if (!market) continue;
    const entry = marketTotals.get(market)!;
    entry.sessions += row._sum.sessions ?? 0;
    entry.conversions += row._sum.conversions ?? 0;
  }

  const totalSessions = ga4Totals._sum.sessions ?? 0;
  const totalConversions = ga4Totals._sum.conversions ?? 0;

  return {
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),

    organicTraffic: {
      totalClicks: gscTotals._sum.clicks ?? 0,
      totalImpressions: gscTotals._sum.impressions ?? 0,
      avgPosition: gscTotals._avg.position ?? null,
      totalSessions,
      dailyClicks: toSeries(dailyClicksMap),
      dailySessions: toSeries(dailySessionsMap),
    },

    leads: {
      formSubmissions,
      bookings,
      total: formSubmissions + bookings,
      dailyLeads: toSeries(dailyLeadsMap),
    },

    conversion: {
      organicConversionRate: totalSessions > 0 ? totalConversions / totalSessions : null,
      leadToTrafficRate: totalSessions > 0 ? (formSubmissions + bookings) / totalSessions : null,
    },

    topPages,
    topKeywords,

    contentPerformance: {
      byGrade,
      avgScore: healthScores.length > 0 ? scoreSum / healthScores.length : null,
      total: healthScores.length,
    },

    seoHealth: seoAuditRun
      ? {
          totalFindings: seoAuditRun.totalFindings,
          categoryCounts: JSON.parse(seoAuditRun.categoryCounts),
          startedAt: seoAuditRun.startedAt.toISOString(),
        }
      : null,

    aiUsage: {
      totalJobs: aiJobs.length,
      byStatus,
      byStage,
    },

    aiCost: {
      totalCost: costSummary?.totalCost ?? 0,
      dailyCost: (costSummary?.dailyCost ?? []).map((d) => ({ date: d.date, value: d.cost })),
      unknownCostJobCount: costSummary?.unknownCostJobCount ?? 0,
    },

    productionVolume: {
      published: { POST: postCount, PAGE: pageCount, CASE_STUDY: caseStudyCount },
      pipelineRunsCompleted,
    },

    refreshOpportunities: {
      byStatus: refreshStatusCounts,
      detected: refreshStatusCounts.DETECTED ?? 0,
    },

    marketPerformance: [...marketTotals.values()].sort((a, b) => b.clicks + b.sessions - (a.clicks + a.sessions)),
  };
}
