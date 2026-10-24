import { prisma } from "@/lib/prisma";
import type { ContentType } from "@/lib/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { matchesConditions, parseConditions } from "./conditions";
import { executeAction } from "./actions";
import type { ActionStep, AutomationEvent, AutomationEventPayload } from "./types";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };
function fail(error: string): StageResult<never> {
  return { success: false, error };
}

function parseActionSteps(raw: string): ActionStep[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActionStep[]) : [];
  } catch {
    return [];
  }
}

function payloadFromRun(run: { event: AutomationEvent; contentType: ContentType; contentId: string; payload: string }): AutomationEventPayload {
  let data: AutomationEventPayload["data"] = {};
  try {
    data = JSON.parse(run.payload);
  } catch {
    // leave data empty — a corrupt/legacy payload shouldn't crash the run
  }
  return { event: run.event, contentType: run.contentType, contentId: run.contentId, data };
}

/**
 * The entry point every event source calls (lib/workflow.ts's
 * transitionContent for CONTENT_PUBLISHED, lib/seo-performance-feedback/
 * scan.ts for the other six). Deliberately swallows every error — an
 * automation rule misbehaving must never break the publish flow or scan
 * it's attached to.
 */
export async function fireAutomationEvent(
  event: AutomationEvent,
  contentType: ContentType,
  contentId: string,
  data: AutomationEventPayload["data"] = {}
): Promise<void> {
  try {
    const payload: AutomationEventPayload = { event, contentType, contentId, data };
    const rules = await prisma.automationRule.findMany({ where: { event, enabled: true } });
    for (const rule of rules) {
      if (!matchesConditions(parseConditions(rule.conditions), payload)) continue;
      await startRun(rule.id, payload);
    }
  } catch (error) {
    console.error(`Failed to fire automation event ${event}:`, error);
  }
}

async function startRun(ruleId: string, payload: AutomationEventPayload): Promise<string | null> {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
  if (!rule) return null;
  const steps = parseActionSteps(rule.actions);
  if (steps.length === 0) return null;

  // Not a nested create (steps: { create: [...] }) — the HTTP-based Neon
  // adapter (see lib/prisma.ts) rejects that the same way it rejects
  // createMany/updateMany/multi-op $transaction, since Prisma compiles a
  // one-to-many nested create as more than one statement under the hood.
  // The run has to exist before its steps can reference runId anyway, so
  // this is sequential-then-concurrent rather than a style choice.
  const run = await prisma.automationRun.create({
    data: {
      ruleId: rule.id,
      event: payload.event,
      contentType: payload.contentType,
      contentId: payload.contentId,
      payload: JSON.stringify(payload.data),
    },
  });

  await Promise.all(
    steps.map((step, index) =>
      prisma.automationStepRun.create({
        data: {
          runId: run.id,
          stepIndex: index,
          actionType: step.type,
          config: JSON.stringify(step.config ?? {}),
          requiresApproval: step.requiresApproval,
        },
      })
    )
  );

  await advanceRun(run.id);
  return run.id;
}

/**
 * Runs every PENDING step in order until the chain finishes, fails, or
 * hits one that requires approval. Safe to call again on a run that's
 * already AWAITING_APPROVAL/FAILED/REJECTED/SUCCEEDED — it's a no-op,
 * since approveStep is the only thing that moves a run off
 * AWAITING_APPROVAL back to RUNNING.
 */
async function advanceRun(runId: string): Promise<void> {
  const run = await prisma.automationRun.findUnique({ where: { id: runId }, include: { steps: { orderBy: { stepIndex: "asc" } } } });
  if (!run || run.status !== "RUNNING") return;

  const payload = payloadFromRun(run);

  for (const step of run.steps) {
    if (step.status === "SUCCEEDED") continue;

    if (step.requiresApproval) {
      await prisma.automationStepRun.update({ where: { id: step.id }, data: { status: "AWAITING_APPROVAL" } });
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "AWAITING_APPROVAL" } });
      revalidatePath("/admin/automation");
      return;
    }

    const config = JSON.parse(step.config) as Record<string, string>;
    const result = await executeAction(step.actionType, payload, config);

    if (result.success) {
      await prisma.automationStepRun.update({ where: { id: step.id }, data: { status: "SUCCEEDED", output: JSON.stringify(result.output) } });
    } else {
      await prisma.automationStepRun.update({ where: { id: step.id }, data: { status: "FAILED", error: result.error } });
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date() } });
      revalidatePath("/admin/automation");
      return;
    }
  }

  await prisma.automationRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", completedAt: new Date() } });
  revalidatePath("/admin/automation");
}

/** Executes the pending approval step now, then resumes the chain — approving and running are the same action, same as every other approval gate in this codebase (e.g. attachGeneratedImage). */
export async function approveStep(stepId: string): Promise<StageResult<null>> {
  try {
    const session = await requirePermission("APPROVE");
    const step = await prisma.automationStepRun.findUnique({ where: { id: stepId }, include: { run: true } });
    if (!step) return fail("Step not found");
    if (step.status !== "AWAITING_APPROVAL") return fail(`This step is not awaiting approval (status: ${step.status})`);

    const payload = payloadFromRun(step.run);
    const config = JSON.parse(step.config) as Record<string, string>;
    const result = await executeAction(step.actionType, payload, config);

    await prisma.automationStepRun.update({
      where: { id: stepId },
      data: result.success
        ? { status: "SUCCEEDED", output: JSON.stringify(result.output), approvedById: session.user.id, approvedAt: new Date() }
        : { status: "FAILED", error: result.error, approvedById: session.user.id, approvedAt: new Date() },
    });
    await logAudit({ action: "approve", category: "Approval", entityType: "AutomationStepRun", entityId: stepId, entityLabel: step.actionType });

    if (result.success) {
      await prisma.automationRun.update({ where: { id: step.runId }, data: { status: "RUNNING" } });
      await advanceRun(step.runId);
    } else {
      await prisma.automationRun.update({ where: { id: step.runId }, data: { status: "FAILED", completedAt: new Date() } });
    }

    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to approve automation step ${stepId}:`, error);
    return fail("Failed to approve step");
  }
}

/** Stops the whole run — every later step is left PENDING, never silently executed or skipped. */
export async function rejectStep(stepId: string): Promise<StageResult<null>> {
  try {
    const session = await requirePermission("APPROVE");
    const step = await prisma.automationStepRun.findUnique({ where: { id: stepId } });
    if (!step) return fail("Step not found");
    if (step.status !== "AWAITING_APPROVAL") return fail(`This step is not awaiting approval (status: ${step.status})`);

    await prisma.automationStepRun.update({ where: { id: stepId }, data: { status: "REJECTED", approvedById: session.user.id, approvedAt: new Date() } });
    await prisma.automationRun.update({ where: { id: step.runId }, data: { status: "REJECTED", completedAt: new Date() } });
    await logAudit({ action: "reject", category: "Approval", entityType: "AutomationStepRun", entityId: stepId, entityLabel: step.actionType });

    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to reject automation step ${stepId}:`, error);
    return fail("Failed to reject step");
  }
}

/** "Run Now" on a specific piece of content — lets an admin test a rule without waiting for the real event, bypassing its conditions (the admin already chose this exact rule+content on purpose). */
export async function runRuleManually(ruleId: string, contentType: ContentType, contentId: string): Promise<StageResult<{ runId: string }>> {
  try {
    await requirePermission("EDIT");
    const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });
    if (!rule) return fail("Rule not found");

    const record =
      contentType === "POST"
        ? await prisma.post.findUnique({ where: { id: contentId }, select: { title: true, slug: true } })
        : contentType === "CASE_STUDY"
        ? await prisma.caseStudy.findUnique({ where: { id: contentId }, select: { title: true, slug: true } })
        : await prisma.page.findUnique({ where: { id: contentId }, select: { title: true, slug: true } });
    if (!record) return fail("Content not found");

    const runId = await startRun(rule.id, { event: rule.event, contentType, contentId, data: { title: record.title, slug: record.slug } });
    if (!runId) return fail("This rule has no action steps configured");

    revalidatePath("/admin/automation");
    return { success: true, data: { runId } };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to manually run automation rule ${ruleId}:`, error);
    return fail("Failed to run rule");
  }
}
