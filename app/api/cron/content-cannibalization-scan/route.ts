import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runCannibalizationScan } from "@/lib/content-cannibalization/cannibalization";

// Same CRON_SECRET pattern as app/api/cron/content-refresh-scan.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the content cannibalization scan");
  if (denied) return denied;

  const result = await runCannibalizationScan();
  return NextResponse.json(result);
}
