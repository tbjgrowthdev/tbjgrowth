import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { recordUptimeCheck } from "@/lib/uptime-monitor";

// Reported into, not triggered from: the actual probe runs from GitHub
// Actions (.github/workflows/uptime-check.yml), outside Cloudflare, since a
// probe running inside the Worker can't detect the Worker itself being
// unreachable. Same CRON_SECRET pattern as the other /api/cron/* routes.
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req, "record the uptime check");
  if (denied) return denied;

  const body = await req.json();
  const check = await recordUptimeCheck({
    up: Boolean(body.up),
    statusCode: typeof body.statusCode === "number" ? body.statusCode : null,
    contentOk: body.contentOk !== undefined ? Boolean(body.contentOk) : true,
    latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : null,
    error: typeof body.error === "string" ? body.error : null,
  });

  return NextResponse.json({ id: check.id });
}
