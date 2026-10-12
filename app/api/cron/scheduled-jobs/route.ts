import { NextRequest, NextResponse } from "next/server";
import { processDueJobs } from "@/lib/scheduled-jobs";

// Hosting-agnostic cron target: protected by CRON_SECRET rather than a
// session (there is no browser session in a cron context). Works with
// Vercel Cron (see vercel.json) or any external scheduler (cron-job.org,
// GitHub Actions, etc.) that can send this header on a timer.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run scheduled jobs.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await processDueJobs();
  return NextResponse.json({ processed: results.length, results });
}
