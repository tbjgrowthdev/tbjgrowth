import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import type { BrandSectionKey } from "@/lib/generated/prisma/client";
import { BRAND_SECTION_KEYS } from "./constants";

export { BRAND_SECTION_KEYS, SECTION_LABEL, SECTION_HELP } from "./constants";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

function fail(error: string): StageResult<never> {
  return { success: false, error };
}

export async function listBrandSections() {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const sections = await prisma.brandKnowledgeSection.findMany({ include: { activeVersion: true } });
    const byKey = new Map(sections.map((s) => [s.key, s]));

    const userIds = [...new Set(sections.map((s) => s.updatedById || s.createdById))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    const names = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

    return BRAND_SECTION_KEYS.map((key) => {
      const section = byKey.get(key) ?? null;
      return { key, section, updatedByName: section ? names.get(section.updatedById || section.createdById) ?? null : null };
    });
  } catch (error) {
    console.error("Failed to list brand knowledge sections:", error);
    return BRAND_SECTION_KEYS.map((key) => ({ key, section: null, updatedByName: null }));
  }
}

export async function getBrandSectionDetail(key: BrandSectionKey) {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
  } catch {
    return { key, section: null, authors: new Map<string, string>(), forbidden: true as const };
  }

  try {
    const section = await prisma.brandKnowledgeSection.findUnique({
      where: { key },
      include: { activeVersion: true, versions: { orderBy: { versionNumber: "desc" } } },
    });
    if (!section) return { key, section: null, authors: new Map<string, string>(), forbidden: false as const };

    const userIds = [...new Set([section.createdById, section.updatedById, ...section.versions.map((v) => v.createdById)].filter((id): id is string => Boolean(id)))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    const authors = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

    return { key, section, authors, forbidden: false as const };
  } catch (error) {
    console.error(`Failed to load brand knowledge section ${key}:`, error);
    return null;
  }
}

/** Same "editing and publishing are the same action" shape as PromptTemplate's savePromptVersion. */
export async function saveBrandSectionVersion(
  key: BrandSectionKey,
  data: { content: string; changeNote?: string }
): Promise<StageResult<{ sectionId: string; versionId: string }>> {
  if (!data.content.trim()) return fail("Content is required");

  try {
    const session = await requirePermission("SETTINGS_MANAGEMENT");
    const existing = await prisma.brandKnowledgeSection.findUnique({ where: { key }, include: { versions: { select: { versionNumber: true }, orderBy: { versionNumber: "desc" }, take: 1 } } });
    const nextVersionNumber = (existing?.versions[0]?.versionNumber ?? 0) + 1;

    if (!existing) {
      // Not a nested create (versions: { create: {...} }) — the HTTP-based
      // Neon adapter (see lib/prisma.ts) rejects that the same way it
      // rejects createMany/updateMany/multi-op $transaction, since Prisma
      // compiles a nested relational create as more than one statement.
      const section = await prisma.brandKnowledgeSection.create({
        data: { key, createdById: session.user.id, updatedById: session.user.id },
      });
      const version = await prisma.brandKnowledgeVersion.create({
        data: {
          sectionId: section.id,
          versionNumber: 1,
          content: data.content,
          changeNote: data.changeNote || "Initial version",
          createdById: session.user.id,
        },
      });
      const versionId = version.id;
      await prisma.brandKnowledgeSection.update({ where: { id: section.id }, data: { activeVersionId: versionId } });
      await logAudit({ action: "create", category: "Settings", entityType: "BrandKnowledgeSection", entityId: section.id, entityLabel: key });
      return { success: true, data: { sectionId: section.id, versionId } };
    }

    const version = await prisma.brandKnowledgeVersion.create({
      data: { sectionId: existing.id, versionNumber: nextVersionNumber, content: data.content, changeNote: data.changeNote || null, createdById: session.user.id },
    });
    await prisma.brandKnowledgeSection.update({ where: { id: existing.id }, data: { activeVersionId: version.id, updatedById: session.user.id } });
    await logAudit({ action: "update", category: "Settings", entityType: "BrandKnowledgeSection", entityId: existing.id, entityLabel: key, after: { versionNumber: nextVersionNumber } });
    return { success: true, data: { sectionId: existing.id, versionId: version.id } };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to save brand knowledge version for ${key}:`, error);
    return fail("Failed to save version");
  }
}

/** Rollback IS this — pointing activeVersionId at any existing version. Nothing is ever deleted. */
export async function activateBrandSectionVersion(sectionId: string, versionId: string): Promise<StageResult<null>> {
  try {
    const session = await requirePermission("SETTINGS_MANAGEMENT");
    const version = await prisma.brandKnowledgeVersion.findUnique({ where: { id: versionId } });
    if (!version || version.sectionId !== sectionId) return fail("Version not found");

    await prisma.brandKnowledgeSection.update({ where: { id: sectionId }, data: { activeVersionId: versionId, updatedById: session.user.id } });
    await logAudit({ action: "activate", category: "Settings", entityType: "BrandKnowledgeSection", entityId: sectionId, after: { versionNumber: version.versionNumber } });
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return fail(error.message);
    console.error(`Failed to activate brand knowledge version ${versionId}:`, error);
    return fail("Failed to activate version");
  }
}
