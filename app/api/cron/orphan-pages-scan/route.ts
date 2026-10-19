import { NextRequest, NextResponse } from "next/server";
import { runOrphanPageScan } from "@/lib/orphan-pages/orphan-pages";

// Same CRON_SECRET pattern as app/api/cron/content-cannibalization-scan.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret) {
    console.error("CRON_SECRET is not configured — refusing to run the orphan page scan.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runOrphanPageScan();
  return NextResponse.json(result);
}
