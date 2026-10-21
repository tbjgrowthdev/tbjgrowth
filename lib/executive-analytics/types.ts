// Executive Analytics is a read-only rollup — it introduces no new tables.
// Every number here is read from a model/aggregation another feature
// already built (SearchConsoleMetric, AnalyticsLandingPageMetric,
// ContentHealthScore, SeoAuditRun, AiJob, ContentRefresh, Location, ...).
// See lib/executive-analytics/aggregate.ts for how each tile is computed.

export const WINDOW_OPTIONS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOW_OPTIONS)[number];

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface TopPageRow {
  path: string;
  clicks: number;
  impressions: number;
  sessions: number;
}

export interface TopKeywordRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface MarketPerformanceRow {
  market: string;
  locationCount: number;
  clicks: number;
  impressions: number;
  sessions: number;
  conversions: number;
}

export interface ExecutiveAnalyticsData {
  windowDays: number;
  windowStart: string;
  windowEnd: string;

  organicTraffic: {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number | null;
    totalSessions: number;
    dailyClicks: DailyPoint[];
    dailySessions: DailyPoint[];
  };

  leads: {
    formSubmissions: number;
    bookings: number;
    total: number;
    dailyLeads: DailyPoint[];
  };

  conversion: {
    // GA4-tracked conversions on organic sessions, already summed from real
    // counts (never an average of per-row rates — see AnalyticsLandingPageMetric's
    // own schema comment on why).
    organicConversionRate: number | null;
    // Leads (form submissions + bookings) as a share of organic sessions —
    // a rougher blended number since not every lead arrives via organic search.
    leadToTrafficRate: number | null;
  };

  topPages: TopPageRow[];
  topKeywords: TopKeywordRow[];

  contentPerformance: {
    byGrade: Record<string, number>;
    avgScore: number | null;
    total: number;
  };

  seoHealth: {
    totalFindings: number;
    categoryCounts: Record<string, number>;
    startedAt: string;
  } | null;

  aiUsage: {
    totalJobs: number;
    byStatus: Record<string, number>;
    byStage: Record<string, number>;
  };

  aiCost: {
    totalCost: number;
    dailyCost: DailyPoint[];
    unknownCostJobCount: number;
  };

  productionVolume: {
    published: Record<string, number>; // POST | PAGE | CASE_STUDY -> count in window
    pipelineRunsCompleted: number; // ContentPipelineRun reaching PUBLISHED in window
  };

  refreshOpportunities: {
    byStatus: Record<string, number>;
    detected: number; // DETECTED specifically — the "needs attention" count
  };

  marketPerformance: MarketPerformanceRow[];
}
