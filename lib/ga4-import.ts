import prisma from "@/lib/prisma";
import { fetchGA4LandingPageRows, type GA4LandingPageRow } from "@/lib/seo-services";
import { resolveContentMap } from "@/lib/content-url-mapping";

/** GA4's `date` dimension comes back as "YYYYMMDD" with no separators. */
function parseGa4Date(raw: string): Date {
  return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
}

export interface Ga4ImportResult {
  rowsImported: number;
  mappedToContent: number;
  unmapped: number;
}

/**
 * Pulls organic-search GA4 landing-page rows for [startDate, endDate] and
 * upserts them into AnalyticsLandingPageMetric with their resolved content
 * mapping (see lib/content-url-mapping.ts — the same mapper the GSC import
 * uses, since GA4's `landingPage` dimension is already a bare path). An
 * upsert, not a skip-duplicates insert, so re-importing a range always
 * reflects GA4's latest processed numbers for it.
 */
export async function importGA4AnalyticsData(startDate: string, endDate: string): Promise<Ga4ImportResult | { error: string }> {
  const rows: GA4LandingPageRow[] | null = await fetchGA4LandingPageRows(startDate, endDate);
  if (rows === null) {
    return { error: "GA4 import failed — check the Google connection and GA4 Property ID in Settings" };
  }
  if (rows.length === 0) {
    return { rowsImported: 0, mappedToContent: 0, unmapped: 0 };
  }

  const distinctPaths = Array.from(new Set(rows.map((r) => r.landingPage)));
  const contentMap = await resolveContentMap(distinctPaths);

  let mappedToContent = 0;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // Not $transaction() — the HTTP-based Neon adapter (lib/prisma.ts)
    // rejects any transaction with more than one operation. Upserts are
    // idempotent and keyed independently, so concurrent + retry-safe is fine.
    await Promise.all(
      chunk.map((row) => {
        const match = contentMap.get(row.landingPage) ?? null;
        if (match) mappedToContent++;
        return prisma.analyticsLandingPageMetric.upsert({
          where: { date_landingPage: { date: parseGa4Date(row.date), landingPage: row.landingPage } },
          create: {
            date: parseGa4Date(row.date),
            landingPage: row.landingPage,
            sessions: row.sessions,
            engagedSessions: row.engagedSessions,
            conversions: row.conversions,
            contentType: match?.contentType ?? null,
            contentId: match?.contentId ?? null,
          },
          update: {
            sessions: row.sessions,
            engagedSessions: row.engagedSessions,
            conversions: row.conversions,
            contentType: match?.contentType ?? null,
            contentId: match?.contentId ?? null,
          },
        });
      })
    );
  }

  return { rowsImported: rows.length, mappedToContent, unmapped: rows.length - mappedToContent };
}
