import { NextRequest, NextResponse } from "next/server";
import { runRefreshScan } from "@/lib/content-refresh/refresh";

// Same CRON_SECRET pattern as app/api/cron/link-check — no browser session
// exists in a cron context, so this calls runRefreshScan() directly
// instead of the permission-gated scanAndUpsertCandidates() action.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run the content refresh scan.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRefreshScan(null);
  return NextResponse.json(result);
}
