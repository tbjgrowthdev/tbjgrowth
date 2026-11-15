import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { processDueJobs } from "@/lib/scheduled-jobs";
import { processNewsletterCampaigns } from "@/lib/newsletter-campaigns";

// Hosting-agnostic cron target: protected by CRON_SECRET rather than a
// session (there is no browser session in a cron context). Works with
// Vercel Cron (see vercel.json) or any external scheduler (cron-job.org,
// GitHub Actions, etc.) that can send this header on a timer.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run scheduled jobs");
  if (denied) return denied;

  const results = await processDueJobs();
  // Also sends newsletter emails for newly published posts (including any a
  // job above just published), and resumes any still in progress.
  let newsletter: unknown;
  try {
    newsletter = await processNewsletterCampaigns();
  } catch (error) {
    console.error("Newsletter campaign run failed:", error);
    newsletter = { error: "failed" };
  }
  return NextResponse.json({ processed: results.length, results, newsletter });
}
