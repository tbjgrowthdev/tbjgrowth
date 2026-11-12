import { NextRequest, NextResponse } from "next/server";
import { captureError } from "@/lib/error-monitor";
import { isCrossSiteRequest, withinIpAndGlobalLimits } from "@/lib/rate-limit";

// Unauthenticated by necessity — a crashed client can't carry a session or
// a cron secret. Abuse protection:
//   - cross-site browser requests and bodies over MAX_BODY_BYTES are refused;
//   - Cloudflare rate-limit bindings (wrangler.jsonc): per IP, plus an
//     overall ceiling per Cloudflare location;
//   - captureError's per-fingerprint alert dedup (lib/error-monitor.ts), so
//     what does get through won't spam the alert inbox, and message/stack
//     are truncated before storage;
//   - ErrorLog rows are deleted after 90 days (/api/cron/log-retention).
// Always answers { ok: true } on success paths — a client reporting a crash
// has nothing useful to do with an error back.

// A minified stack trace is a few KB; this leaves plenty of headroom.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  if (isCrossSiteRequest(req)) return new Response(null, { status: 403 });

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  if (!(await withinIpAndGlobalLimits(req, "CLIENT_ERROR_IP_LIMITER", "CLIENT_ERROR_GLOBAL_LIMITER"))) {
    return new Response(null, { status: 429 });
  }

  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
    const body = JSON.parse(text);
    await captureError({
      message: typeof body?.message === "string" ? body.message : "Unknown client error",
      stack: typeof body?.stack === "string" ? body.stack : null,
      path: typeof body?.path === "string" ? body.path : null,
      digest: typeof body?.digest === "string" ? body.digest : null,
      source: "client",
    });
  } catch {
    // Reporting a client error must never itself throw back at the client.
  }
  return NextResponse.json({ ok: true });
}
