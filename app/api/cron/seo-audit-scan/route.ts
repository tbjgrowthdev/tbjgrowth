import { NextRequest, NextResponse } from "next/server";
import { runSeoAudit } from "@/lib/seo-audits/run";

// Same CRON_SECRET pattern as app/api/cron/link-check — see that file for
// the reasoning (no browser session exists in a cron context).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run the SEO audit scan.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await runSeoAudit("cron");
  return NextResponse.json({ id: run.id, totalFindings: run.totalFindings });
}
