import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runLinkCheck } from "@/lib/link-monitor";

// Same CRON_SECRET pattern as app/api/cron/scheduled-jobs — see that file
// for the reasoning (no browser session exists in a cron context).
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the link check");
  if (denied) return denied;

  const run = await runLinkCheck("cron");
  return NextResponse.json({
    id: run.id,
    internalBroken: run.internalBroken,
    externalBroken: run.externalBroken,
    redirectIssues: run.redirectIssues,
  });
}
