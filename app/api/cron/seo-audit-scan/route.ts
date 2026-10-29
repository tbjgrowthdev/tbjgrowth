import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runSeoAudit } from "@/lib/seo-audits/run";

// Same CRON_SECRET pattern as app/api/cron/link-check — see that file for
// the reasoning (no browser session exists in a cron context).
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the SEO audit scan");
  if (denied) return denied;

  const run = await runSeoAudit("cron");
  return NextResponse.json({ id: run.id, totalFindings: run.totalFindings });
}
