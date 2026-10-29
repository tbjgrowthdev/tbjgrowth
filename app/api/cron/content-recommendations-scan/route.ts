import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runRecommendationScan } from "@/lib/content-recommendations/recommend";

// Same CRON_SECRET pattern as app/api/cron/content-refresh-scan.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the content recommendations scan");
  if (denied) return denied;

  const result = await runRecommendationScan();
  return NextResponse.json(result);
}
