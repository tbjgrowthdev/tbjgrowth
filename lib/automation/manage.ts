import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import type { AutomationEvent } from "@/lib/generated/prisma/client";
import { AUTOMATION_ACTION_TYPES, AUTOMATION_EVENTS, type ActionStep, type RuleConditions } from "./types";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };
function fail(error: string): StageResult<never> {
  return { success: false, error };
}

export interface RuleInput {
  name: string;
  description?: string;
  event: AutomationEvent;
  conditions: RuleConditions;
  actions: ActionStep[];
  enabled: boolean;
}

function validateRuleInput(input: RuleInput): string | null {
  if (!input.name.trim()) return "Name is required";
  if (!AUTOMATION_EVENTS.includes(input.event)) return "Invalid event";
  if (input.actions.length === 0) return "At least one action is required";
  for (const step of input.actions) {
    if (!AUTOMATION_ACTION_TYPES.includes(step.type)) return `Invalid action type "${step.type}"`;
  }
  return null;
}

export async function listAutomationRules() {
  try {
    await requirePermission("EDIT");
    return await prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } });
  } catch (error) {
    console.error("Failed to list automation rules:", error);
    return [];
  }
}

export async function getAutomationRule(id: string) {
  try {
    await requirePermission("EDIT");
    return await prisma.automationRule.findUnique({ where: { id } });
  } catch (error) {
    console.error(`Failed to load automation rule ${id}:`, error);
    return null;
  }
}

export async function createAutomationRule(input: RuleInput): Promise<StageResult<{ id: string }>> {
  const validationError = validateRuleInput(input);
  if (validationError) return fail(validationError);

  try {
    const session = await requirePermission("SETTINGS_MANAGEMENT");
    const rule = await prisma.automationRule.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        event: input.event,
        conditions: JSON.stringify(input.conditions),
        actions: JSON.stringify(input.actions),
        enabled: input.enabled,
        createdById: session.user.id,
      },
    });
    await logAudit({ action: "create", category: "Settings", entityType: "AutomationRule", entityId: rule.id, entityLabel: rule.name });
    revalidatePath("/admin/automation");
    return { success: true, data: { id: rule.id } };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error("Failed to create automation rule:", error);
    return fail("Failed to create rule");
  }
}

export async function updateAutomationRule(id: string, input: RuleInput): Promise<StageResult<null>> {
  const validationError = validateRuleInput(input);
  if (validationError) return fail(validationError);

  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const existing = await prisma.automationRule.findUnique({ where: { id } });
    if (!existing) return fail("Rule not found");

    await prisma.automationRule.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        event: input.event,
        conditions: JSON.stringify(input.conditions),
        actions: JSON.stringify(input.actions),
        enabled: input.enabled,
      },
    });
    await logAudit({ action: "update", category: "Settings", entityType: "AutomationRule", entityId: id, entityLabel: input.name });
    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to update automation rule ${id}:`, error);
    return fail("Failed to update rule");
  }
}

export async function toggleAutomationRule(id: string, enabled: boolean): Promise<StageResult<null>> {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const rule = await prisma.automationRule.update({ where: { id }, data: { enabled } });
    await logAudit({ action: enabled ? "enable" : "disable", category: "Settings", entityType: "AutomationRule", entityId: id, entityLabel: rule.name });
    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to toggle automation rule ${id}:`, error);
    return fail("Failed to update rule");
  }
}

export async function deleteAutomationRule(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const rule = await prisma.automationRule.findUnique({ where: { id } });
    if (!rule) return fail("Rule not found");
    await prisma.automationRule.delete({ where: { id } });
    await logAudit({ action: "delete", category: "Settings", entityType: "AutomationRule", entityId: id, entityLabel: rule.name, before: { name: rule.name } });
    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to delete automation rule ${id}:`, error);
    return fail("Failed to delete rule");
  }
}

export async function listAutomationRuns(limit = 100) {
  try {
    await requirePermission("EDIT");
    const runs = await prisma.automationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { rule: { select: { name: true } }, steps: { orderBy: { stepIndex: "asc" } } },
    });

    const postIds = runs.filter((r) => r.contentType === "POST").map((r) => r.contentId);
    const caseIds = runs.filter((r) => r.contentType === "CASE_STUDY").map((r) => r.contentId);
    const pageIds = runs.filter((r) => r.contentType === "PAGE").map((r) => r.contentId);
    const [posts, cases, pages] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true } }),
      prisma.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, title: true } }),
    ]);
    const titles = new Map([...posts, ...cases, ...pages].map((c) => [c.id, c.title]));

    return runs.map((r) => ({ ...r, contentTitle: titles.get(r.contentId) ?? r.contentId }));
  } catch (error) {
    console.error("Failed to list automation runs:", error);
    return [];
  }
}

export async function listSocialDrafts() {
  try {
    await requirePermission("EDIT");
    const drafts = await prisma.socialDraft.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" } });

    const postIds = drafts.filter((d) => d.contentType === "POST").map((d) => d.contentId);
    const caseIds = drafts.filter((d) => d.contentType === "CASE_STUDY").map((d) => d.contentId);
    const [posts, cases] = await Promise.all([
      prisma.post.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, slug: true } }),
      prisma.caseStudy.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true, slug: true } }),
    ]);
    const titles = new Map([...posts, ...cases].map((c) => [c.id, { title: c.title, slug: c.slug }]));

    return drafts.map((d) => ({ ...d, content: titles.get(d.contentId) ?? null }));
  } catch (error) {
    console.error("Failed to list social drafts:", error);
    return [];
  }
}

export async function dismissSocialDraft(id: string): Promise<StageResult<null>> {
  try {
    await requirePermission("EDIT");
    await prisma.socialDraft.update({ where: { id }, data: { status: "DISMISSED" } });
    revalidatePath("/admin/automation");
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to dismiss social draft ${id}:`, error);
    return fail("Failed to dismiss draft");
  }
}
