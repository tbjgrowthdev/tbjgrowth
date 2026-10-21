import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { getActiveImageProvider, getActiveProvider } from "./providers";
import type { AiUsage } from "./providers/types";
import { estimateCostUsd } from "./pricing";
import type { PipelineStage } from "@/lib/generated/prisma/client";

/**
 * Starts (or resumes) the tracked job for one (pipelineRun, stage) pair.
 * `idempotencyKey` is "<pipelineRunId>:<stage>" — at most one job row ever
 * exists per stage per run, so this is the actual idempotency mechanism,
 * not just a label: calling a stage twice after it already COMPLETED
 * returns `alreadyCompleted: true` without creating a second job or
 * letting the caller redo the Claude call/side effects. Calling it again
 * after FAILED resumes the SAME job (same Job ID), incrementing
 * retryCount — a manual retry, never an automatic one.
 */
export async function startOrResumeJob(
  pipelineRunId: string,
  stage: PipelineStage,
  contentId: string | null
): Promise<{ id: string; alreadyCompleted: boolean }> {
  const idempotencyKey = `${pipelineRunId}:${stage}`;
  const existing = await prisma.aiJob.findUnique({ where: { idempotencyKey } });
  // Read fresh each call (not cached), so a retry after an admin changes
  // AI_PROVIDER/ANTHROPIC_MODEL/etc. correctly records the provider/model
  // that's actually about to run — a completed job keeps whatever it
  // recorded on its own successful attempt.
  const provider = getActiveProvider();

  if (!existing) {
    const created = await prisma.aiJob.create({
      data: {
        idempotencyKey,
        pipelineRunId,
        contentId,
        stage,
        provider: provider.name,
        model: provider.model,
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });
    return { id: created.id, alreadyCompleted: false };
  }

  if (existing.status === "COMPLETED") {
    return { id: existing.id, alreadyCompleted: true };
  }

  // FAILED -> this is a retry. QUEUED/PROCESSING with no completedAt means
  // a previous request died mid-flight (crash, timeout) — also safe to
  // resume as a fresh attempt, since nothing downstream was ever marked done.
  const updated = await prisma.aiJob.update({
    where: { id: existing.id },
    data: {
      status: "PROCESSING",
      retryCount: existing.status === "FAILED" ? existing.retryCount + 1 : existing.retryCount,
      error: null,
      startedAt: new Date(),
      completedAt: null,
      provider: provider.name,
      model: provider.model,
      contentId: contentId ?? existing.contentId,
    },
  });
  return { id: updated.id, alreadyCompleted: false };
}

// Looks up the job's own recorded provider/model to price `usage` against
// lib/content-pipeline/pricing.ts — reading it back rather than taking it
// as a parameter keeps every call site (8 stage functions) simple: they
// just pass the token counts callAiForJson already handed them.
async function usageFields(jobId: string, usage?: AiUsage) {
  if (!usage) return {};
  const job = await prisma.aiJob.findUnique({ where: { id: jobId }, select: { provider: true, model: true } });
  const totalTokens = usage.inputTokens + usage.outputTokens;
  const costUsd = job ? estimateCostUsd(job.provider, job.model, usage.inputTokens, usage.outputTokens) : null;
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens, costUsd };
}

export async function completeJob(jobId: string, options: { contentId?: string | null; usage?: AiUsage; flatCostUsd?: number | null } = {}) {
  await prisma.aiJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      ...(options.contentId ? { contentId: options.contentId } : {}),
      ...(options.flatCostUsd !== undefined ? { costUsd: options.flatCostUsd } : await usageFields(jobId, options.usage)),
    },
  });
}

export async function failJob(jobId: string, error: string, usage?: AiUsage) {
  await prisma.aiJob.update({
    where: { id: jobId },
    data: { status: "FAILED", error: error.slice(0, 4000), completedAt: new Date(), ...(await usageFields(jobId, usage)) },
  });
}

/**
 * Creates a FRESH AiJob — deliberately NOT the idempotent
 * startOrResumeJob()/"already completed is a no-op" pattern most stages
 * use. Some stages (Image, Internal Links) let a human explicitly ask for
 * a fresh attempt before they've approved anything ("Regenerate") — that's
 * a repeatable human choice, not an accidental double-click/retried
 * request, so each call gets its own Job ID rather than reusing or
 * short-circuiting on a prior completed attempt. Whatever the prior
 * attempt produced (an unused MediaAsset, a discarded suggestion batch)
 * is left as-is rather than deleted — same "nothing destructive happens
 * automatically" stance as everywhere else in this schema.
 */
async function createFreshJob(pipelineRunId: string, stage: PipelineStage, contentId: string | null, provider: { name: string; model: string }): Promise<{ id: string }> {
  const created = await prisma.aiJob.create({
    data: {
      idempotencyKey: `${pipelineRunId}:${stage}:${crypto.randomUUID()}`,
      pipelineRunId,
      contentId,
      stage,
      provider: provider.name,
      model: provider.model,
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });
  return { id: created.id };
}

export async function createImageJob(pipelineRunId: string, contentId: string | null): Promise<{ id: string }> {
  return createFreshJob(pipelineRunId, "IMAGE", contentId, getActiveImageProvider());
}

/** Same non-idempotent "fresh job every call" shape as createImageJob, for text stages that support regeneration (currently just Internal Links). */
export async function createTextJob(pipelineRunId: string, stage: PipelineStage, contentId: string | null): Promise<{ id: string }> {
  return createFreshJob(pipelineRunId, stage, contentId, getActiveProvider());
}

/**
 * Jobs for a ContentRefresh cycle use `contentRefreshId`, not
 * `pipelineRunId` — a separate creator since the FK differs, not just a
 * parameter swap. Always fresh (never idempotent-short-circuited): every
 * refresh cycle only ever drafts once at a time, but "regenerate this
 * draft" after a rejection is exactly the same deliberate-repeat case as
 * Image/Internal Links above.
 */
export async function createRefreshJob(contentRefreshId: string, contentId: string | null): Promise<{ id: string }> {
  const provider = getActiveProvider();
  const created = await prisma.aiJob.create({
    data: {
      idempotencyKey: `${contentRefreshId}:REFRESH:${crypto.randomUUID()}`,
      contentRefreshId,
      contentId,
      stage: "REFRESH",
      provider: provider.name,
      model: provider.model,
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });
  return { id: created.id };
}

/** Same shape as createRefreshJob, for the AI diagnosis call behind PerformanceFeedback. */
export async function createPerformanceFeedbackJob(performanceFeedbackId: string, contentId: string | null): Promise<{ id: string }> {
  const provider = getActiveProvider();
  const created = await prisma.aiJob.create({
    data: {
      idempotencyKey: `${performanceFeedbackId}:PERFORMANCE_FEEDBACK:${crypto.randomUUID()}`,
      performanceFeedbackId,
      contentId,
      stage: "PERFORMANCE_FEEDBACK",
      provider: provider.name,
      model: provider.model,
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });
  return { id: created.id };
}

export async function getJobsForRun(pipelineRunId: string) {
  try {
    await requirePermission("CREATE");
    return await prisma.aiJob.findMany({ where: { pipelineRunId }, orderBy: { queuedAt: "asc" } });
  } catch (error) {
    console.error(`Failed to fetch jobs for run ${pipelineRunId}:`, error);
    return [];
  }
}

export async function getJobsForRefresh(contentRefreshId: string) {
  try {
    await requirePermission("EDIT");
    return await prisma.aiJob.findMany({ where: { contentRefreshId }, orderBy: { queuedAt: "asc" } });
  } catch (error) {
    console.error(`Failed to fetch jobs for refresh ${contentRefreshId}:`, error);
    return [];
  }
}

export async function getAllJobs() {
  try {
    await requirePermission("CREATE");
    return await prisma.aiJob.findMany({
      orderBy: { queuedAt: "desc" },
      take: 200,
      include: {
        pipelineRun: { select: { contentType: true, brief: true } },
        contentRefresh: { select: { contentType: true, draftTitle: true } },
      },
    });
  } catch (error) {
    console.error("Failed to fetch AI jobs:", error);
    return [];
  }
}
