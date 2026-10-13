import { NextRequest, NextResponse } from "next/server";
import { captureError } from "@/lib/error-monitor";

// Unauthenticated by necessity — a crashed client can't carry a session or
// a cron secret. Abuse is bounded by captureError's own per-fingerprint
// alert dedup (see lib/error-monitor.ts): spamming this route logs rows but
// won't spam the alert inbox, and message/stack are truncated before
// storage regardless of what's sent.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
