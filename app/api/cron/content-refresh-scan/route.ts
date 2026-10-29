import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runRefreshScan } from "@/lib/content-refresh/refresh";

// Same CRON_SECRET pattern as app/api/cron/link-check — no browser session
// exists in a cron context, so this calls runRefreshScan() directly
// instead of the permission-gated scanAndUpsertCandidates() action.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the content refresh scan");
  if (denied) return denied;

  const result = await runRefreshScan(null);
  return NextResponse.json(result);
}
