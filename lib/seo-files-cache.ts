import { unstable_cache } from "next/cache";

// Cache for the crawler-facing files: /robots.txt and the /sitemap*.xml
// routes. Without it every crawler hit queried Neon (the posts/pages/case
// study sitemaps run one hreflang lookup per entry).
//
// Why a data cache and not route-level ISR (`export const revalidate`) like
// the public pages: a route handler with no dynamic segment can't opt out of
// being prerendered at build time, so ISR would query the database from the
// build machine — whatever `.env` points at there — and ship that snapshot.
// Here the routes stay `force-dynamic` (nothing runs at build), and only the
// rendered text is cached, in the same OpenNext incremental cache (R2 +
// regional cache) as the pages, keyed per file.
//
// Freshness:
//   - lib/revalidate.ts's revalidatePublicSite() expires SEO_FILES_CACHE_TAG
//     immediately. Every admin change to public content already calls it
//     (including scheduled publish/unpublish from the cron), so the next
//     crawler request after a publish/unpublish gets a freshly built file.
//   - SEO_FILES_REVALIDATE_SECONDS is only the safety net for a change that
//     somehow skips that call.
// Only the string is cached: a failure inside `build` throws and is not
// stored, so a database hiccup never gets cached as an empty sitemap.

export const SEO_FILES_CACHE_TAG = "seo-files";
export const SEO_FILES_REVALIDATE_SECONDS = 3600;

export function cachedSeoFile(key: string, build: () => Promise<string>): Promise<string> {
  return unstable_cache(build, ["seo-file", key], {
    tags: [SEO_FILES_CACHE_TAG],
    revalidate: SEO_FILES_REVALIDATE_SECONDS,
  })();
}

/** Response for a sitemap. Crawlers are told to recheck each time; the Worker answers from the cache above. */
export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
