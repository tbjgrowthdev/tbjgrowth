import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { runClientReminders } from "@/lib/clients/reminders";
import { now } from "@/lib/clients/clock";

// Every 15 minutes (.github/workflows/app-cron.yml): meeting reminders,
// overdue invoices and stale-project nudges (lib/clients/reminders.ts).
// Answers 500 if any part failed (the others still ran), so the GitHub
// Actions job goes red.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req, "run the client reminders");
  if (denied) return denied;
  const summary = await runClientReminders(now());
  return NextResponse.json(summary, { status: summary.errors.length > 0 ? 500 : 200 });
}
