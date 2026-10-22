import prisma from "@/lib/prisma";
import { fetchSearchConsoleRows, type SearchConsoleRow } from "@/lib/seo-services";
import { parseUrlPath, resolveContentMap } from "@/lib/content-url-mapping";

export interface GscImportResult {
  rowsImported: number;
  mappedToContent: number;
  unmapped: number;
}

/**
 * Pulls Search Console rows for [startDate, endDate] and upserts them into
 * SearchConsoleMetric with their resolved content mapping (see
 * lib/content-url-mapping.ts). An upsert, not a skip-duplicates insert,
 * because GSC's own data for the most recent 1-3 days is provisional and
 * can change on a later pull for the same date — re-importing a range
 * should always reflect GSC's latest numbers.
 */
export async function importSearchConsoleData(startDate: string, endDate: string): Promise<GscImportResult | { error: string }> {
  const rows: SearchConsoleRow[] | null = await fetchSearchConsoleRows(startDate, endDate);
  if (rows === null) {
    return { error: "Search Console import failed — check the Google connection in Settings" };
  }
  if (rows.length === 0) {
    return { rowsImported: 0, mappedToContent: 0, unmapped: 0 };
  }

  const pathForUrl = new Map(rows.map((r) => [r.page, parseUrlPath(r.page)]));
  const distinctPaths = Array.from(new Set(pathForUrl.values()));
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
        const match = contentMap.get(pathForUrl.get(row.page)!) ?? null;
        if (match) mappedToContent++;
        return prisma.searchConsoleMetric.upsert({
          where: {
            date_query_page_country_device: {
              date: new Date(row.date),
              query: row.query,
              page: row.page,
              country: row.country,
              device: row.device,
            },
          },
          create: {
            date: new Date(row.date),
            query: row.query,
            page: row.page,
            country: row.country,
            device: row.device,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            contentType: match?.contentType ?? null,
            contentId: match?.contentId ?? null,
          },
          update: {
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            contentType: match?.contentType ?? null,
            contentId: match?.contentId ?? null,
          },
        });
      })
    );
  }

  return { rowsImported: rows.length, mappedToContent, unmapped: rows.length - mappedToContent };
}
