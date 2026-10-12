import { NextRequest, NextResponse } from "next/server";
import { runLinkCheck } from "@/lib/link-monitor";

// Same CRON_SECRET pattern as app/api/cron/scheduled-jobs — see that file
// for the reasoning (no browser session exists in a cron context).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run the link check.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await runLinkCheck("cron");
  return NextResponse.json({
    id: run.id,
    internalBroken: run.internalBroken,
    externalBroken: run.externalBroken,
    redirectIssues: run.redirectIssues,
  });
}
