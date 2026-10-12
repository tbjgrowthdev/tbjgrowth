type RedirectEntry = { destination: string | null; statusCode: number };

let cache: { map: Map<string, RedirectEntry>; expiresAt: number } | null = null;
const TTL_MS = 60_000;

// middleware.ts runs on the Edge runtime (Cloudflare's OpenNext adapter
// doesn't support Node.js middleware), so it can't use the Prisma/pg
// client directly here — fetch() is the one DB-adjacent primitive Edge
// middleware and Node both support, so this calls the Route Handler at
// /api/internal/redirects (a normal Node function) instead of querying
// Prisma in-process.
export async function getRedirectMap(requestUrl: string): Promise<Map<string, RedirectEntry>> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.map;
  }

  try {
    const res = await fetch(new URL("/api/internal/redirects", requestUrl));
    if (!res.ok) throw new Error(`redirects fetch failed: ${res.status}`);
    const redirects: { source: string; destination: string | null; statusCode: number }[] = await res.json();
    const map = new Map(redirects.map((r) => [r.source, { destination: r.destination, statusCode: r.statusCode }]));
    cache = { map, expiresAt: Date.now() + TTL_MS };
    return map;
  } catch (error) {
    console.error("Failed to load redirects:", error);
    return cache?.map ?? new Map();
  }
}

/** Called after admin create/delete/import so new redirects take effect immediately instead of waiting on TTL. */
export function invalidateRedirectCache() {
  cache = null;
}
