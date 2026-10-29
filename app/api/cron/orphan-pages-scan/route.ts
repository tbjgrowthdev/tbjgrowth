import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runOrphanPageScan } from "@/lib/orphan-pages/orphan-pages";

// Same CRON_SECRET pattern as app/api/cron/content-cannibalization-scan.
export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the orphan page scan");
  if (denied) return denied;

  const result = await runOrphanPageScan();
  return NextResponse.json(result);
}
