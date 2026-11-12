import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { parseWebVitalsBatch, WEB_VITALS_MAX_BODY_BYTES } from "@/lib/web-vitals";
import { isCrossSiteRequest, withinIpAndGlobalLimits } from "@/lib/rate-limit";

// Public by necessity (real visitors have no session). Abuse protection, in
// the order it's checked, cheapest first:
//   1. Cross-site browser requests are refused (Origin / Sec-Fetch-Site).
//   2. Oversized bodies are refused before being read in full.
//   3. Cloudflare rate-limit bindings (wrangler.jsonc): per visitor IP, and
//      an overall ceiling per Cloudflare location so a flood from many IPs
//      still can't push unlimited rows into Neon.
//   4. Strict validation; the rating is computed server-side.
//   5. Old rows are deleted nightly (/api/cron/log-retention), so the table
//      can't grow without bound.
// One request carries every metric for one page load.

const noContent = (status = 204) => new Response(null, { status });

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) return noContent(403);

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > WEB_VITALS_MAX_BODY_BYTES) return noContent(413);

  if (!(await withinIpAndGlobalLimits(req, "WEB_VITALS_IP_LIMITER", "WEB_VITALS_GLOBAL_LIMITER"))) return noContent(429);

  let batch;
  try {
    const text = await req.text();
    if (text.length > WEB_VITALS_MAX_BODY_BYTES) return noContent(413);
    batch = parseWebVitalsBatch(JSON.parse(text));
  } catch {
    batch = null;
  }
  if (!batch) return noContent(400);

  try {
    const { path, samples } = batch;
    // Not createMany: the Neon HTTP adapter can't run it (docs/known-limitations.md).
    // Up to five independent single-row inserts, run concurrently.
    await Promise.all(
      samples.map((s) => prisma.webVitalSample.create({ data: { path, metric: s.metric, value: s.value, rating: s.rating } }))
    );
  } catch (error) {
    console.error("Failed to store web vital samples:", error);
    return noContent(500);
  }

  return noContent();
}
