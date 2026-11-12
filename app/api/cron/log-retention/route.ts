import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runRetention } from "@/lib/retention";

// Nightly (.github/workflows/app-cron.yml). Deletes old rows from log-type
// tables; the per-table rules are in lib/retention.ts.
//
// `?dryRun=1` deletes nothing and reports how many rows each rule would
// delete — run it once by hand before trusting the schedule:
//   curl -H "Authorization: Bearer $CRON_SECRET" "$PRODUCTION_URL/api/cron/log-retention?dryRun=1"
//
// Answers 500 if any table failed (the others still ran), so the GitHub
// Actions job goes red.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the log retention cleanup");
  if (denied) return denied;

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const results = await runRetention({ dryRun });
  const failed = results.some((r) => "error" in r);

  return NextResponse.json({ dryRun, results }, { status: failed ? 500 : 200 });
}
