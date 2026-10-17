import { NextRequest, NextResponse } from "next/server";
import { runRecommendationScan } from "@/lib/content-recommendations/recommend";

// Same CRON_SECRET pattern as app/api/cron/content-refresh-scan.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run the content recommendations scan.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runRecommendationScan();
  return NextResponse.json(result);
}
