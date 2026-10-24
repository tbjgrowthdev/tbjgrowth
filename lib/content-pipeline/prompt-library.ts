import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import type { PromptCategory } from "@/lib/generated/prisma/client";
import { PROMPT_CATEGORIES } from "./prompt-constants";

export { PROMPT_CATEGORIES, WIRED_CATEGORIES, CATEGORY_LABEL, DEFAULT_BODY_TEMPLATE, fillTemplate } from "./prompt-constants";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

export type ResolvedPrompt = { systemPrompt: string | null; bodyTemplate: string };

/**
 * Returns the active version's text for a category, or null if nothing's
 * been authored yet. Callers in prompts.ts always have their own
 * hardcoded default to fall back to — this feature is additive; a fresh
 * install with an empty PromptTemplate table behaves identically to
 * before the Prompt Library existed.
 */
export async function resolvePrompt(category: PromptCategory): Promise<ResolvedPrompt | null> {
  const template = await prisma.promptTemplate.findUnique({
    where: { category },
    include: { activeVersion: true },
  });
  if (!template?.activeVersion) return null;
  return { systemPrompt: template.activeVersion.systemPrompt, bodyTemplate: template.activeVersion.bodyTemplate };
}

export async function listPromptTemplates() {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const templates = await prisma.promptTemplate.findMany({ include: { activeVersion: true } });
    const byCategory = new Map(templates.map((t) => [t.category, t]));

    const userIds = [...new Set(templates.map((t) => t.updatedById || t.createdById))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    const names = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

    return PROMPT_CATEGORIES.map((category) => {
      const template = byCategory.get(category) ?? null;
      return { category, template, updatedByName: template ? names.get(template.updatedById || template.createdById) ?? null : null };
    });
  } catch (error) {
    console.error("Failed to list prompt templates:", error);
    return PROMPT_CATEGORIES.map((category) => ({ category, template: null, updatedByName: null }));
  }
}

export async function getPromptTemplateDetail(category: PromptCategory) {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
  } catch {
    return { category, template: null, authors: new Map<string, string>(), forbidden: true as const };
  }

  try {
    const template = await prisma.promptTemplate.findUnique({
      where: { category },
      include: { activeVersion: true, versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!template) return { category, template: null, authors: new Map<string, string>(), forbidden: false as const };

    const userIds = [...new Set([template.createdById, template.updatedById, ...template.versions.map((v) => v.createdById)].filter((id): id is string => Boolean(id)))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    const authors = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

    return { category, template, authors, forbidden: false as const };
  } catch (error) {
    console.error(`Failed to load prompt template ${category}:`, error);
    return null;
  }
}

/**
 * Creates a new version and immediately activates it — editing and
 * publishing are the same action here, same as there being no separate
 * "draft a prompt" state. Creates the PromptTemplate row itself on first
 * save for a category that has none yet.
 */
export async function savePromptVersion(
  category: PromptCategory,
  data: { name: string; description?: string; systemPrompt?: string; bodyTemplate: string; changeNote?: string }
): Promise<StageResult<{ templateId: string; versionId: string }>> {
  if (!data.name.trim()) return fail("Name is required");
  if (!data.bodyTemplate.trim()) return fail("Prompt body is required");

  try {
    const session = await requirePermission("SETTINGS_MANAGEMENT");
    const existing = await prisma.promptTemplate.findUnique({ where: { category }, include: { versions: { select: { versionNumber: true }, orderBy: { versionNumber: "desc" }, take: 1 } } });
    const nextVersionNumber = (existing?.versions[0]?.versionNumber ?? 0) + 1;

    if (!existing) {
      // Not a nested create (versions: { create: {...} }) — the HTTP-based
      // Neon adapter (see lib/prisma.ts) rejects that the same way it
      // rejects createMany/updateMany/multi-op $transaction, since Prisma
      // compiles a nested relational create as more than one statement.
      const template = await prisma.promptTemplate.create({
        data: {
          category,
          name: data.name,
          description: data.description || null,
          createdById: session.user.id,
          updatedById: session.user.id,
        },
      });
      const version = await prisma.promptTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          systemPrompt: data.systemPrompt || null,
          bodyTemplate: data.bodyTemplate,
          changeNote: data.changeNote || "Initial version",
          createdById: session.user.id,
        },
      });
      const versionId = version.id;
      await prisma.promptTemplate.update({ where: { id: template.id }, data: { activeVersionId: versionId } });
      await logAudit({ action: "create", category: "Settings", entityType: "PromptTemplate", entityId: template.id, entityLabel: data.name });
      return { success: true, data: { templateId: template.id, versionId } };
    }

    const version = await prisma.promptTemplateVersion.create({
      data: {
        templateId: existing.id,
        versionNumber: nextVersionNumber,
        systemPrompt: data.systemPrompt || null,
        bodyTemplate: data.bodyTemplate,
        changeNote: data.changeNote || null,
        createdById: session.user.id,
      },
    });
    await prisma.promptTemplate.update({
      where: { id: existing.id },
      data: { name: data.name, description: data.description || null, activeVersionId: version.id, updatedById: session.user.id },
    });
    await logAudit({ action: "update", category: "Settings", entityType: "PromptTemplate", entityId: existing.id, entityLabel: data.name, after: { versionNumber: nextVersionNumber } });
    return { success: true, data: { templateId: existing.id, versionId: version.id } };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to save prompt version for ${category}:`, error);
    return fail("Failed to save prompt version");
  }
}

/** Rollback IS this — pointing activeVersionId at any existing version, newer or older. Nothing is deleted either way. */
export async function activatePromptVersion(templateId: string, versionId: string): Promise<StageResult<null>> {
  try {
    const session = await requirePermission("SETTINGS_MANAGEMENT");
    const version = await prisma.promptTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version || version.templateId !== templateId) return fail("Version not found");

    await prisma.promptTemplate.update({ where: { id: templateId }, data: { activeVersionId: versionId, updatedById: session.user.id } });
    await logAudit({ action: "activate", category: "Settings", entityType: "PromptTemplate", entityId: templateId, after: { versionNumber: version.versionNumber } });
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to activate prompt version ${versionId}:`, error);
    return fail("Failed to activate version");
  }
}
