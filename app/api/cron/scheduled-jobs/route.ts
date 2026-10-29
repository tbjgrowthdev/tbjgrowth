import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { processDueJobs } from "@/lib/scheduled-jobs";

// Hosting-agnostic cron target: protected by CRON_SECRET rather than a
// session (there is no browser session in a cron context). Works with
// Vercel Cron (see vercel.json) or any external scheduler (cron-job.org,
// GitHub Actions, etc.) that can send this header on a timer.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run scheduled jobs");
  if (denied) return denied;

  const results = await processDueJobs();
  return NextResponse.json({ processed: results.length, results });
}
