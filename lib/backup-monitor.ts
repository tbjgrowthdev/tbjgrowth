import prisma from "@/lib/prisma";
import { sendBackupAlertNotification } from "@/lib/email";

// Persists the result of a backup run that already happened in CI (see
// .github/workflows/db-backup.yml) and alerts on failure. There is
// deliberately no backup-triggering code here — see BackupRun's schema
// comment for why the dump/upload/verify work can't live in the Worker.
export async function recordBackupRun(params: {
  startedAt: Date;
  completedAt: Date;
  success: boolean;
  sizeBytes?: number | null;
  objectKey?: string | null;
  verified?: boolean;
  error?: string | null;
}) {
  const run = await prisma.backupRun.create({
    data: {
      startedAt: params.startedAt,
      completedAt: params.completedAt,
      success: params.success,
      sizeBytes: params.sizeBytes ?? null,
      objectKey: params.objectKey ?? null,
      verified: params.verified ?? false,
      error: params.error ?? null,
    },
  });

  if (!params.success || !params.verified) {
    const settings = await prisma.siteSetting.findFirst();
    await sendBackupAlertNotification({
      success: params.success,
      verified: params.verified ?? false,
      error: params.error ?? null,
      notifyEmail: settings?.email,
    });
  }

  return run;
}

export async function getBackupHistory(limit = 30) {
  return prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}
