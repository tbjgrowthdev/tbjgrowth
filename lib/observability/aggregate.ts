import prisma from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { listIntegrationStatuses } from "@/lib/integrations/manage";
import type { ObservabilityData, WindowHours } from "./types";

/**
 * Rolls up the Observability spec's three groups (Application,
 * Infrastructure, Business) entirely from signals this app already
 * records — no new monitoring agent, same reasoning as Executive
 * Analytics. The two genuinely new pieces of instrumentation it depends on
 * (EmailLog, SlowQueryLog) were added in lib/email.ts and lib/prisma.ts
 * specifically to make this dashboard honest rather than fabricated.
 *
 * "CPU / RAM / Disk / Storage" from the spec are deliberately left out of
 * this return type — this app runs on Cloudflare Workers, which exposes
 * none of that to application code. They belong in the Cloudflare
 * dashboard (Workers & Pages -> the Worker -> Metrics) and the Cloudinary/
 * R2 dashboards, same "don't duplicate what the platform already does"
 * call as rate limiting in docs/runbooks/security.md.
 */
export async function getObservabilityData(hours: number = 24): Promise<ObservabilityData | null> {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - hours * 60 * 60 * 1000);
  const where = { createdAt: { gte: windowStart } };

  const dbPingStart = Date.now();
  let databaseReachable = true;
  try {
    await prisma.siteSetting.count();
  } catch {
    databaseReachable = false;
  }
  const databaseLatencyMs = Date.now() - dbPingStart;

  const [
    errorCount,
    serverErrorCount,
    clientErrorCount,
    apiFailureCount,
    recentErrors,
    slowRequestCount,
    slowQueryCount,
    recentSlowQueries,
    uptimeChecks,
    failedPublishing,
    failedPublishingCount,
    failedAiJobs,
    failedAiJobCount,
    failedWebhookSteps,
    failedEmails,
    failedEmailCount,
    integrationStatuses,
  ] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.count({ where: { ...where, source: "server" } }),
    prisma.errorLog.count({ where: { ...where, source: "client" } }),
    prisma.errorLog.count({ where: { ...where, source: "server", path: { startsWith: "/api" } } }),
    prisma.errorLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.webVitalSample.count({ where: { ...where, metric: "TTFB", rating: "poor" } }),
    prisma.slowQueryLog.count({ where }),
    prisma.slowQueryLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.uptimeCheck.findMany({ where: { checkedAt: { gte: windowStart } }, orderBy: { checkedAt: "asc" } }),
    prisma.scheduledJob.findMany({ where: { status: "FAILED", updatedAt: { gte: windowStart } }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.scheduledJob.count({ where: { status: "FAILED", updatedAt: { gte: windowStart } } }),
    prisma.aiJob.findMany({ where: { status: "FAILED", completedAt: { gte: windowStart } }, orderBy: { completedAt: "desc" }, take: 20 }),
    prisma.aiJob.count({ where: { status: "FAILED", completedAt: { gte: windowStart } } }),
    prisma.automationStepRun.findMany({
      where: { actionType: "NOTIFY_TEAM", status: "FAILED", updatedAt: { gte: windowStart } },
      include: { run: { select: { ruleId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.emailLog.findMany({ where: { ...where, success: false }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.emailLog.count({ where: { ...where, success: false } }),
    listIntegrationStatuses(),
  ]);

  // Only NOTIFY_TEAM steps whose configured channel is "webhook" count as a
  // "failed webhook" — the same action type also covers Slack and email,
  // which are failures of a different kind (Integration Hub / EmailLog
  // already cover those).
  const failedWebhooks = failedWebhookSteps
    .filter((step) => {
      try {
        return (JSON.parse(step.config) as Record<string, string>).channel === "webhook";
      } catch {
        return false;
      }
    })
    .map((step) => ({ id: step.id, ruleId: step.run.ruleId, error: step.error, createdAt: step.updatedAt.toISOString() }));

  const latencySamples = uptimeChecks.map((c) => c.latencyMs).filter((v): v is number => v != null);
  const avgApiLatencyMs = latencySamples.length ? Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length) : null;

  return {
    windowHours: hours as WindowHours,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),

    application: {
      errorCount,
      serverErrorCount,
      clientErrorCount,
      apiFailureCount,
      recentErrors: recentErrors.map((e) => ({ id: e.id, message: e.message, path: e.path, source: e.source, createdAt: e.createdAt.toISOString() })),
      slowRequestCount,
      slowQueryCount,
      recentSlowQueries: recentSlowQueries.map((q) => ({ id: q.id, model: q.model, action: q.action, durationMs: q.durationMs, createdAt: q.createdAt.toISOString() })),
    },

    infrastructure: {
      databaseReachable,
      databaseLatencyMs,
      apiLatencyTrend: uptimeChecks.map((c) => ({ checkedAt: c.checkedAt.toISOString(), latencyMs: c.latencyMs, up: c.up })),
      avgApiLatencyMs,
    },

    business: {
      failedPublishing: failedPublishing.map((j) => ({
        id: j.id,
        contentType: j.contentType,
        contentId: j.contentId,
        jobType: j.jobType,
        attempts: j.attempts,
        lastError: j.lastError,
        lastAttemptAt: j.lastAttemptAt?.toISOString() ?? null,
      })),
      failedPublishingCount,
      failedAiJobs: failedAiJobs.map((j) => ({
        id: j.id,
        stage: j.stage,
        provider: j.provider,
        model: j.model,
        error: j.error,
        completedAt: j.completedAt?.toISOString() ?? null,
      })),
      failedAiJobCount,
      failedIntegrations: integrationStatuses
        .filter((s) => s.status === "ERROR")
        .map((s) => ({ label: s.label, category: s.category, lastError: s.lastError, lastCheckedAt: s.lastCheckedAt })),
      failedWebhooks,
      failedWebhookCount: failedWebhooks.length,
      failedEmails: failedEmails.map((e) => ({ id: e.id, type: e.type, to: e.to, error: e.error, createdAt: e.createdAt.toISOString() })),
      failedEmailCount,
    },
  };
}
