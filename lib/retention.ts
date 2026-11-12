import prisma from "@/lib/prisma";
import { WEB_VITALS_RETENTION_DAYS } from "@/lib/web-vitals";

// Automatic cleanup of log-type tables, run nightly by
// /api/cron/log-retention (.github/workflows/app-cron.yml).
//
// Every policy is ONE standalone statement (deleteMany, or count() in dry
// run). That's deliberate: the Neon HTTP adapter can't run transactions,
// createMany or updateMany (docs/known-limitations.md), but deleteMany works.
// Policies run one after another and a failure in one doesn't stop the rest.
//
// Deliberately NOT cleaned up here: AuditLog (Super Admin purges it by hand
// in Admin → Audit Log), and business history — AiJob (AI cost dashboard),
// ContentVersion, ApprovalHistory, RankCheck, SearchConsoleMetric,
// AnalyticsLandingPageMetric.

const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionResult = { table: string; rule: string; rows: number } | { table: string; rule: string; error: string };

type Policy = {
  table: string;
  rule: string;
  /** Returns how many rows match (dry run) or were deleted. */
  apply: (cutoff: (days: number) => Date, dryRun: boolean) => Promise<number>;
};

/** Runs the delete, or in dry run the matching count, for one where clause. */
async function deleteOrCount<W>(
  delegate: { count(args: { where: W }): Promise<number>; deleteMany(args: { where: W }): Promise<{ count: number }> },
  where: W,
  dryRun: boolean
): Promise<number> {
  return dryRun ? delegate.count({ where }) : (await delegate.deleteMany({ where })).count;
}

export const RETENTION_POLICIES: Policy[] = [
  {
    table: "SlowQueryLog",
    rule: "older than 30 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.slowQueryLog, { createdAt: { lt: cutoff(30) } }, dryRun),
  },
  {
    table: "WebVitalSample",
    rule: `older than ${WEB_VITALS_RETENTION_DAYS} days`,
    apply: (cutoff, dryRun) => deleteOrCount(prisma.webVitalSample, { createdAt: { lt: cutoff(WEB_VITALS_RETENTION_DAYS) } }, dryRun),
  },
  {
    // The newest check is always kept: lib/uptime-monitor.ts compares each
    // new check with it to decide whether to alert.
    table: "UptimeCheck",
    rule: "older than 30 days, except the newest check",
    apply: async (cutoff, dryRun) => {
      const newest = await prisma.uptimeCheck.findFirst({ orderBy: { checkedAt: "desc" }, select: { id: true } });
      if (!newest) return 0;
      return deleteOrCount(prisma.uptimeCheck, { checkedAt: { lt: cutoff(30) }, id: { not: newest.id } }, dryRun);
    },
  },
  {
    table: "ErrorLog",
    rule: "older than 90 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.errorLog, { createdAt: { lt: cutoff(90) } }, dryRun),
  },
  {
    table: "EmailLog",
    rule: "older than 90 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.emailLog, { createdAt: { lt: cutoff(90) } }, dryRun),
  },
  {
    table: "LoginAttempt",
    rule: "older than 180 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.loginAttempt, { createdAt: { lt: cutoff(180) } }, dryRun),
  },
  {
    // One row per missing path; updatedAt moves on every hit.
    table: "NotFoundLog",
    rule: "path not hit for 90 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.notFoundLog, { updatedAt: { lt: cutoff(90) } }, dryRun),
  },
  {
    // Logins (JWT) expire after 30 days and lastSeenAt is refreshed while a
    // session is in use, so a session unused for 60 days can't be live.
    table: "AdminSession",
    rule: "revoked over 30 days ago, or unused for 60 days",
    apply: (cutoff, dryRun) =>
      deleteOrCount(
        prisma.adminSession,
        { OR: [{ revokedAt: { lt: cutoff(30) } }, { lastSeenAt: { lt: cutoff(60) } }] },
        dryRun
      ),
  },
  {
    table: "LinkCheckRun",
    rule: "older than 90 days, except the newest run",
    apply: async (cutoff, dryRun) => {
      const newest = await prisma.linkCheckRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true } });
      if (!newest) return 0;
      return deleteOrCount(prisma.linkCheckRun, { startedAt: { lt: cutoff(90) }, id: { not: newest.id } }, dryRun);
    },
  },
  {
    table: "SeoAuditRun",
    rule: "older than 90 days, except the newest run",
    apply: async (cutoff, dryRun) => {
      const newest = await prisma.seoAuditRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true } });
      if (!newest) return 0;
      return deleteOrCount(prisma.seoAuditRun, { startedAt: { lt: cutoff(90) }, id: { not: newest.id } }, dryRun);
    },
  },
  {
    table: "BackupRun",
    rule: "older than 365 days",
    apply: (cutoff, dryRun) => deleteOrCount(prisma.backupRun, { startedAt: { lt: cutoff(365) } }, dryRun),
  },
  {
    // Steps are removed with their run by the database (ON DELETE CASCADE).
    // Runs still RUNNING or AWAITING_APPROVAL are never touched.
    table: "AutomationRun",
    rule: "finished over 180 days ago (steps go with them)",
    apply: (cutoff, dryRun) =>
      deleteOrCount(
        prisma.automationRun,
        { status: { in: ["SUCCEEDED", "FAILED", "REJECTED"] }, completedAt: { lt: cutoff(180) } },
        dryRun
      ),
  },
  {
    // PENDING / PROCESSING jobs are never touched.
    table: "ScheduledJob",
    rule: "completed, failed or cancelled over 180 days ago",
    apply: (cutoff, dryRun) =>
      deleteOrCount(
        prisma.scheduledJob,
        { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] }, updatedAt: { lt: cutoff(180) } },
        dryRun
      ),
  },
];

/** Applies every policy in turn. `rows` is rows deleted, or in dry run rows that would be. */
export async function runRetention({ dryRun = false, now = new Date() }: { dryRun?: boolean; now?: Date } = {}): Promise<RetentionResult[]> {
  const cutoff = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const results: RetentionResult[] = [];
  for (const policy of RETENTION_POLICIES) {
    try {
      results.push({ table: policy.table, rule: policy.rule, rows: await policy.apply(cutoff, dryRun) });
    } catch (error) {
      console.error(`Retention cleanup failed for ${policy.table}:`, error);
      results.push({ table: policy.table, rule: policy.rule, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
