import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { recordBackupRun } from "@/lib/backup-monitor";

// Reported into, not triggered from: the actual pg_dump + R2 upload +
// rotation + restore-verification runs in GitHub Actions
// (.github/workflows/db-backup.yml) and POSTs its result here. Same
// CRON_SECRET pattern as app/api/cron/scheduled-jobs and app/api/cron/link-check.
export async function POST(req: NextRequest) {
  const denied = requireCronAuth(req, "record the backup run");
  if (denied) return denied;

  const body = await req.json();
  const run = await recordBackupRun({
    startedAt: new Date(body.startedAt),
    completedAt: new Date(body.completedAt ?? Date.now()),
    success: Boolean(body.success),
    sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
    objectKey: typeof body.objectKey === "string" ? body.objectKey : null,
    verified: Boolean(body.verified),
    error: typeof body.error === "string" ? body.error : null,
  });

  return NextResponse.json({ id: run.id });
}
