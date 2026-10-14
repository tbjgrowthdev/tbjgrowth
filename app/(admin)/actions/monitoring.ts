"use server";

import { requirePermission } from "@/lib/auth-guard";
import { getBackupHistory } from "@/lib/backup-monitor";
import { getUptimeHistory } from "@/lib/uptime-monitor";
import { getErrorLogHistory } from "@/lib/error-monitor";
import { getAllLoginHistory } from "@/app/(admin)/actions/security";

// Read-only — unlike Link Monitor there's no "Run Now" here, since backups
// and uptime probes run in GitHub Actions, outside this app (see
// BackupRun/UptimeCheck's schema comments).
export async function getMonitoringData() {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const [backups, uptime, errors, loginHistory] = await Promise.all([
      getBackupHistory(),
      getUptimeHistory(),
      getErrorLogHistory(),
      getAllLoginHistory(),
    ]);
    return { backups, uptime, errors, loginHistory: loginHistory.attempts };
  } catch (error) {
    console.error("Failed to fetch monitoring data:", error);
    return { backups: [], uptime: [], errors: [], loginHistory: [] };
  }
}
