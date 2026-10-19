import prisma from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { recordVersion } from "@/lib/versioning";
import { sendScheduledJobFailureNotification } from "@/lib/email";
import { notifySearchEnginesOfUrl } from "@/lib/search-engine-ping";
import { PUBLIC_PATH_BUILDERS } from "@/lib/sitemap";
import { revalidatePath } from "next/cache";
import type { ContentType, ScheduledJobType, PostStatus, Prisma } from "@/lib/generated/prisma/client";

const MAX_ATTEMPTS = 5;

type AnyRecord = Record<string, unknown>;
type Delegate = {
  findUnique(args: { where: { id: string } }): Promise<AnyRecord | null>;
  update(args: { where: { id: string }; data: AnyRecord }): Promise<{ id: string; slug: string }>;
};

const MODEL: Record<ContentType, Delegate> = {
  POST: prisma.post as unknown as Delegate,
  PAGE: prisma.page as unknown as Delegate,
  CASE_STUDY: prisma.caseStudy as unknown as Delegate,
};

const ENTITY_TYPE: Record<ContentType, string> = {
  POST: "Post",
  PAGE: "Page",
  CASE_STUDY: "CaseStudy",
};

const REVALIDATE_PATHS: Record<ContentType, (slug: string, id: string) => string[]> = {
  POST: (slug, id) => ["/admin/posts", `/admin/posts/${id}`, "/blog", `/blog/${slug}`],
  PAGE: (slug, id) => ["/admin/pages", `/admin/pages/${id}`, `/${slug}`],
  CASE_STUDY: (slug, id) => ["/admin/case-studies", `/admin/case-studies/${id}`, "/case-studies", `/case-studies/${slug}`],
};

// ---------------------------------------------------------------------------
// Creation / cancellation — called from an authenticated admin context.
// ---------------------------------------------------------------------------

export async function createScheduledJob(
  contentType: ContentType,
  contentId: string,
  jobType: ScheduledJobType,
  runAt: Date,
  timezone: string,
  payload?: Record<string, unknown>
) {
  try {
    const session = await requirePermission(jobType === "UPDATE" ? "EDIT" : "SCHEDULE");

    // Re-scheduling replaces, rather than stacking, a pending job of the
    // same type for the same content — one active PUBLISH/UNPUBLISH/UPDATE
    // schedule per content item at a time.
    await prisma.scheduledJob.updateMany({
      where: { contentType, contentId, jobType, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    const job = await prisma.scheduledJob.create({
      data: {
        contentType,
        contentId,
        jobType,
        runAt,
        timezone,
        payload: payload ? JSON.stringify(payload) : null,
        createdById: session.user.id,
        createdByName: session.user.name ?? null,
        createdByEmail: session.user.email ?? null,
      },
    });

    await logAudit({
      action: "schedule",
      category: "Publishing",
      entityType: ENTITY_TYPE[contentType],
      entityId: contentId,
      entityLabel: `${jobType} scheduled for ${runAt.toISOString()}`,
      after: { jobType, runAt: runAt.toISOString(), timezone },
    });

    return { success: true, job };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create scheduled job:", error);
    return { success: false, error: "Failed to schedule" };
  }
}

export async function cancelScheduledJob(id: string) {
  try {
    await requirePermission("SCHEDULE");
    const job = await prisma.scheduledJob.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await logAudit({
      action: "cancelSchedule",
      category: "Publishing",
      entityType: ENTITY_TYPE[job.contentType],
      entityId: job.contentId,
      entityLabel: `Cancelled ${job.jobType} scheduled for ${job.runAt.toISOString()}`,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to cancel scheduled job ${id}:`, error);
    return { success: false, error: error.message };
  }
}

export async function getScheduledJobs(contentType: ContentType, contentId: string) {
  try {
    await requireSession();
    return await prisma.scheduledJob.findMany({
      where: { contentType, contentId, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      orderBy: { runAt: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch scheduled jobs:", error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Processing — called ONLY from the cron route (app/api/cron/scheduled-jobs),
// which authenticates the request with CRON_SECRET at the HTTP layer, not
// via a NextAuth session (cron has no browser session to check). The
// authorization for the action itself already happened when a permitted
// admin CREATED the job above; this is just carrying out an already-approved
// instruction at the time it said to run.
// ---------------------------------------------------------------------------

export async function processDueJobs() {
  const dueJobs = await prisma.scheduledJob.findMany({
    where: { status: "PENDING", runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: 50,
  });

  const results = [];
  for (const job of dueJobs) {
    results.push(await processJob(job.id));
  }
  return results;
}

async function processJob(id: string) {
  // Atomic claim: only proceeds if the row is still PENDING right now, so
  // two overlapping cron invocations can't both pick up the same job.
  const claim = await prisma.scheduledJob.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 }, lastAttemptAt: new Date() },
  });
  if (claim.count === 0) {
    return { id, skipped: true };
  }

  const job = await prisma.scheduledJob.findUnique({ where: { id } });
  if (!job) return { id, skipped: true };

  try {
    await executeJob(job);
    await prisma.scheduledJob.update({ where: { id }, data: { status: "COMPLETED", lastError: null } });
    return { id, success: true };
  } catch (error: any) {
    const message = error?.message || "Unknown error";
    const willRetry = job.attempts < MAX_ATTEMPTS;
    await prisma.scheduledJob.update({
      where: { id },
      data: { status: willRetry ? "PENDING" : "FAILED", lastError: message },
    });
    console.error(`Scheduled job ${id} (attempt ${job.attempts}/${MAX_ATTEMPTS}) failed:`, error);
    await sendScheduledJobFailureNotification({
      contentType: job.contentType,
      contentId: job.contentId,
      jobType: job.jobType,
      attempt: job.attempts,
      maxAttempts: MAX_ATTEMPTS,
      willRetry,
      error: message,
      notifyEmail: job.createdByEmail,
    });
    return { id, success: false, error: message, willRetry };
  }
}

async function executeJob(job: Prisma.ScheduledJobGetPayload<object>) {
  const delegate = MODEL[job.contentType];
  const current = await delegate.findUnique({ where: { id: job.contentId } });
  if (!current) {
    throw new Error(`Content ${job.contentType}:${job.contentId} no longer exists`);
  }

  const actor = { id: job.createdById, name: job.createdByName, email: job.createdByEmail };

  if (job.jobType === "PUBLISH" || job.jobType === "UNPUBLISH") {
    const fromStatus = current.status as PostStatus;
    const toStatus = job.jobType === "PUBLISH" ? "PUBLISHED" : "DRAFT";
    const updateData: AnyRecord = { status: toStatus };
    if (toStatus === "PUBLISHED" && !current.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const updated = await delegate.update({ where: { id: job.contentId }, data: updateData });

    await prisma.approvalHistory.create({
      data: {
        contentType: job.contentType,
        contentId: job.contentId,
        fromStatus,
        toStatus,
        action: job.jobType === "PUBLISH" ? "publish" : "unpublish",
        comment: `Executed by scheduled job (originally set up by ${actor.name || actor.email || "unknown"})`,
        actorId: actor.id || job.createdById || "system",
      },
    });

    for (const path of REVALIDATE_PATHS[job.contentType](updated.slug, job.contentId)) {
      revalidatePath(path);
    }

    // Same one-time-on-newly-PUBLISHED notification as the manual workflow
    // path (lib/workflow.ts) — a scheduled publish is still a publish event.
    if (toStatus === "PUBLISHED" && fromStatus !== "PUBLISHED" && current.isIndexable !== false) {
      await notifySearchEnginesOfUrl(PUBLIC_PATH_BUILDERS[job.contentType](updated.slug));
    }

    await logAudit({
      action: job.jobType === "PUBLISH" ? "publish" : "unpublish",
      category: "Publishing",
      entityType: ENTITY_TYPE[job.contentType],
      entityId: job.contentId,
      entityLabel: updated.slug,
      before: { status: fromStatus },
      after: { status: toStatus },
    });
    return;
  }

  // UPDATE — apply the staged snapshot to the live record, same shape as a
  // normal edit, and record it as a new content version per the "never
  // overwrite history, create a new version" rule.
  if (!job.payload) {
    throw new Error("Scheduled update job has no payload");
  }
  const snapshot = JSON.parse(job.payload) as AnyRecord;
  const { categoryIds, tagIds, ...scalarFields } = snapshot;

  const updateData: AnyRecord = { ...scalarFields };
  if (job.contentType !== "PAGE") {
    if (Array.isArray(categoryIds)) {
      updateData.categories = { set: (categoryIds as string[]).map((cid) => ({ id: cid })) };
    }
    if (Array.isArray(tagIds)) {
      updateData.tags = { set: (tagIds as string[]).map((tid) => ({ id: tid })) };
    }
  }

  const updated = await delegate.update({ where: { id: job.contentId }, data: updateData });

  const categoryIdList = Array.isArray(categoryIds) ? (categoryIds as string[]) : [];
  const tagIdList = Array.isArray(tagIds) ? (tagIds as string[]) : [];

  await recordVersion(
    job.contentType,
    job.contentId,
    { ...updated, categories: categoryIdList.map((cid) => ({ id: cid })), tags: tagIdList.map((tid) => ({ id: tid })) },
    { id: actor.id || "system", name: actor.name, email: actor.email },
    "Scheduled update applied"
  );

  for (const path of REVALIDATE_PATHS[job.contentType](updated.slug, job.contentId)) {
    revalidatePath(path);
  }

  await logAudit({
    action: "update",
    category: "Content",
    entityType: ENTITY_TYPE[job.contentType],
    entityId: job.contentId,
    entityLabel: `Scheduled update applied`,
    after: scalarFields,
  });
}
