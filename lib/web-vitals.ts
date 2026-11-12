// Shared by the browser reporter (components/WebVitalsReporter.tsx), the
// ingest route (app/api/web-vitals) and the admin read side
// (app/(admin)/actions/technical.ts, lib/observability/aggregate.ts).
// Pure functions only, so it is safe to import on both client and server.

export const WEB_VITAL_METRICS = ["LCP", "FCP", "TTFB", "INP", "CLS"] as const;
export type WebVitalMetric = (typeof WEB_VITAL_METRICS)[number];

/** Google's Core Web Vitals thresholds (same values the web-vitals library uses). */
export const WEB_VITAL_THRESHOLDS: Record<WebVitalMetric, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
};

/**
 * Share of page loads that report web vitals at all. Every metric of a
 * sampled page load is sent together in one request, so the p75 values stay
 * accurate; only the number of rows shrinks. 1 = every page load reports,
 * because traffic is low and the p75 tiles need the samples. Lower it (e.g.
 * 0.25) once traffic grows enough that the admin tiles still show a few
 * hundred samples a week.
 */
export const WEB_VITALS_SAMPLE_RATE = 1;

/** Rows older than this are deleted by /api/cron/log-retention (lib/retention.ts). Matches the longest Observability window (30d). */
export const WEB_VITALS_RETENTION_DAYS = 30;

/** Largest request body the ingest route accepts. A real report is about 150 bytes. */
export const WEB_VITALS_MAX_BODY_BYTES = 1024;

const MAX_PATH_LENGTH = 200;

// Anything above these is not a real measurement (2 minutes for timings; CLS
// above 10 would mean the whole viewport shifted ten times over).
const MAX_VALUE: Record<WebVitalMetric, number> = {
  LCP: 120_000,
  FCP: 120_000,
  TTFB: 120_000,
  INP: 120_000,
  CLS: 10,
};

export function isWebVitalMetric(name: unknown): name is WebVitalMetric {
  return typeof name === "string" && (WEB_VITAL_METRICS as readonly string[]).includes(name);
}

export function rateWebVital(metric: WebVitalMetric, value: number): "good" | "needs-improvement" | "poor" {
  const t = WEB_VITAL_THRESHOLDS[metric];
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

export type WebVitalsBatch = {
  path: string;
  samples: { metric: WebVitalMetric; value: number; rating: string }[];
};

/**
 * Validates one report from the browser: `{ path, metrics: { LCP: 1234, CLS: 0.02, ... } }`.
 * Returns null if the report is unusable. Unknown metric names are ignored;
 * out-of-range values are dropped. The rating is computed here, never taken
 * from the client.
 */
export function parseWebVitalsBatch(body: unknown): WebVitalsBatch | null {
  if (!body || typeof body !== "object") return null;
  const { path, metrics } = body as { path?: unknown; metrics?: unknown };

  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
  const cleanPath = path.split(/[?#]/, 1)[0].slice(0, MAX_PATH_LENGTH);

  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;

  const samples: WebVitalsBatch["samples"] = [];
  for (const metric of WEB_VITAL_METRICS) {
    const value = (metrics as Record<string, unknown>)[metric];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_VALUE[metric]) continue;
    samples.push({ metric, value, rating: rateWebVital(metric, value) });
  }

  return samples.length > 0 ? { path: cleanPath, samples } : null;
}
