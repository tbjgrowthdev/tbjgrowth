import { getCloudflareContext } from "@opennextjs/cloudflare";

// Helpers for the public, unauthenticated endpoints (app/api/web-vitals,
// app/api/internal/client-error). The limiters are Cloudflare rate-limit
// bindings declared under "ratelimits" in wrangler.jsonc: approximate, and
// counted separately in each Cloudflare location.

type RateLimiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

export type RateLimiterName =
  | "WEB_VITALS_IP_LIMITER"
  | "WEB_VITALS_GLOBAL_LIMITER"
  | "CLIENT_ERROR_IP_LIMITER"
  | "CLIENT_ERROR_GLOBAL_LIMITER";

function getLimiter(name: RateLimiterName): RateLimiter | undefined {
  try {
    return (getCloudflareContext().env as unknown as Record<string, RateLimiter | undefined>)[name];
  } catch {
    // `next dev` has no Cloudflare context: no limiting locally.
    return undefined;
  }
}

/** True if the request may proceed. Missing binding or a limiter error both allow it. */
export async function withinRateLimit(name: RateLimiterName, key: string): Promise<boolean> {
  const limiter = getLimiter(name);
  if (!limiter) return true;
  try {
    return (await limiter.limit({ key })).success;
  } catch {
    // A limiter outage shouldn't drop every real visitor's request.
    return true;
  }
}

/**
 * Checks a per-IP limiter and then an overall one (key "all"), so a flood
 * from many IPs is capped too. The overall one is only consulted when the
 * per-IP one allows the request.
 */
export async function withinIpAndGlobalLimits(req: Request, perIp: RateLimiterName, global: RateLimiterName): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  return (await withinRateLimit(perIp, ip)) && (await withinRateLimit(global, "all"));
}

/**
 * True for a browser request sent from another site. Requests without
 * Origin / Sec-Fetch-Site (curl, scripts) aren't cross-site by this test;
 * the rate limits are what bound those.
 */
export function isCrossSiteRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return true;

  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}
