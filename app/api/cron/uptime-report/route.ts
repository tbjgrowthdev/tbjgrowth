import { NextRequest, NextResponse } from "next/server";
import { recordUptimeCheck } from "@/lib/uptime-monitor";

// Reported into, not triggered from: the actual probe runs from GitHub
// Actions (.github/workflows/uptime-check.yml), outside Cloudflare, since a
// probe running inside the Worker can't detect the Worker itself being
// unreachable. Same CRON_SECRET pattern as the other /api/cron/* routes.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to record the uptime check.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
