"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "@/lib/revalidate";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { countAllBlockUsage, findBlockUsage, type BlockUsage } from "@/lib/blocks/usage";
import type { DependencyFinding } from "@/lib/dependency-check";
import { isBlockType, normalizeBlocksInput, parseBlockData, type BlockType } from "@/lib/blocks/schema";
import { validateImportDocument } from "@/lib/case-study-import";
import { slugify } from "@/lib/utils";

type Result<T> = ({ success: true } & T) | { success: false; error: string };

const NAME_MAX = 120;

const isUniqueViolation = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

// A reusable block is live the moment it is saved on every page that uses it — there is no draft state and no
// per-page review of an edit to it. So changing or deleting one needs PUBLISH (EDITOR and above), the same bar as
// putting content live, rather than the weaker EDIT a CONTRIBUTOR has. Creating one only makes it *available*: it
// shows nowhere until a page that goes through the normal workflow references it, so CREATE is enough.

function revalidateUsage(usage: BlockUsage) {
  revalidatePath("/admin/blocks");
  for (const page of usage.pages) revalidatePath(`/${page.slug}`);
  // Locale-prefixed copies and every generated pSEO page: cheaper than enumerating them.
  revalidatePath("/[locale]/[slug]", "page");
  for (const c of usage.caseStudies) revalidatePath(`/case-studies/${c.slug}`);
  if (usage.templates.length) revalidatePath("/[locale]/pSEO/[slug]", "page");
}

export async function getContentBlocks() {
  try {
    await requireSession();
    return await prisma.contentBlock.findMany({ orderBy: { updatedAt: "desc" } });
  } catch (error) {
    console.error("Failed to fetch content blocks:", error);
    return [];
  }
}

/** Block id -> number of pages and pSEO templates using it. */
export async function getContentBlockUsageCounts(): Promise<Record<string, number>> {
  try {
    await requireSession();
    return Object.fromEntries(await countAllBlockUsage());
  } catch (error) {
    console.error("Failed to count content block usage:", error);
    return {};
  }
}

export async function getContentBlock(id: string) {
  try {
    await requireSession();
    const block = await prisma.contentBlock.findUnique({ where: { id } });
    if (!block) return null;
    return { block, usage: await findBlockUsage(id) };
  } catch (error) {
    console.error(`Failed to fetch content block ${id}:`, error);
    return null;
  }
}

/** Library data the block editor's pickers need (testimonials, FAQs, pricing packages, reusable blocks). */
export async function getBlockEditorOptions() {
  try {
    await requireSession();
    const [testimonials, faqs, packages, reusable] = await Promise.all([
      prisma.testimonial.findMany({ orderBy: { order: "asc" }, select: { id: true, clientName: true, company: true } }),
      prisma.faq.findMany({ orderBy: { order: "asc" }, select: { id: true, question: true } }),
      prisma.pricingPackage.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, isActive: true } }),
      prisma.contentBlock.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    ]);
    return {
      testimonials: testimonials.map((t) => ({ value: t.id, label: t.company ? `${t.clientName} — ${t.company}` : t.clientName })),
      faqs: faqs.map((f) => ({ value: f.id, label: f.question })),
      packages: packages.map((p) => ({ value: p.slug, label: p.isActive ? p.name : `${p.name} (inactive)` })),
      reusable,
    };
  } catch (error) {
    console.error("Failed to load block editor options:", error);
    return { testimonials: [], faqs: [], packages: [], reusable: [] };
  }
}

function validate(name: unknown, type: unknown, data: unknown): Result<{ name: string; type: BlockType; data: string }> {
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) return { success: false, error: "Name is required" };
  if (cleanName.length > NAME_MAX) return { success: false, error: `Name must be ${NAME_MAX} characters or fewer` };
  if (!isBlockType(type)) return { success: false, error: "Unknown block type" };
  const parsed = parseBlockData(type, data);
  if (!parsed.ok) return { success: false, error: parsed.error };
  return { success: true, name: cleanName, type, data: JSON.stringify(parsed.value) };
}

export async function createContentBlock(input: { name: string; type: string; data: unknown }): Promise<Result<{ id: string }>> {
  try {
    const session = await requirePermission("CREATE");
    const v = validate(input?.name, input?.type, input?.data);
    if (!v.success) return v;
    const block = await prisma.contentBlock.create({
      data: { name: v.name, type: v.type, data: v.data, createdById: session.user.id, updatedById: session.user.id },
    });
    revalidatePath("/admin/blocks");
    await logAudit({ action: "create", category: "Content", entityType: "ContentBlock", entityId: block.id, entityLabel: block.name, after: { type: block.type } });
    return { success: true, id: block.id };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    if (isUniqueViolation(error)) return { success: false, error: "A reusable block with this name already exists" };
    console.error("Failed to create content block:", error);
    return { success: false, error: "Failed to create block" };
  }
}

export async function updateContentBlock(id: string, input: { name: string; data: unknown }): Promise<Result<{ id: string; usedIn: number }>> {
  try {
    const session = await requirePermission("PUBLISH");
    const before = await prisma.contentBlock.findUnique({ where: { id } });
    if (!before) return { success: false, error: "Block not found" };
    // The type is fixed after creation: pages were composed around it, and changing it would silently swap what they show.
    const v = validate(input?.name, before.type, input?.data);
    if (!v.success) return v;
    const block = await prisma.contentBlock.update({ where: { id }, data: { name: v.name, data: v.data, updatedById: session.user.id } });
    const usage = await findBlockUsage(id);
    revalidateUsage(usage);
    revalidatePath(`/admin/blocks/${id}`);
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "ContentBlock",
      entityId: id,
      entityLabel: block.name,
      before: { name: before.name, data: before.data },
      after: { name: block.name, data: block.data, usedOnPages: usage.pages.length, usedInTemplates: usage.templates.length, usedInCaseStudies: usage.caseStudies.length },
    });
    return { success: true, id, usedIn: usage.pages.length + usage.templates.length + usage.caseStudies.length };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    if (isUniqueViolation(error)) return { success: false, error: "A reusable block with this name already exists" };
    console.error(`Failed to update content block ${id}:`, error);
    return { success: false, error: "Failed to update block" };
  }
}

// Blocked while pages or pSEO templates still use it, unless `force` is set (the UI passes it after listing the
// usage). A forced delete is safe for visitors: references to a missing block are skipped at render time.
export async function deleteContentBlock(id: string, options?: { force?: boolean }): Promise<Result<object> & { dependencies?: DependencyFinding[] }> {
  try {
    await requirePermission("PUBLISH");
    await requirePermission("DELETE");
    const before = await prisma.contentBlock.findUnique({ where: { id } });
    if (!before) return { success: false, error: "Block not found" };
    const usage = await findBlockUsage(id);
    const used = usage.pages.length + usage.templates.length + usage.caseStudies.length;
    if (used > 0 && !options?.force) {
      // Same shape the shared DeleteButton already knows how to list and confirm (see lib/dependency-check.ts).
      const dependencies: DependencyFinding[] = [
        ...usage.pages.map((p) => ({ category: "Related Content" as const, description: `Used on page "${p.title}"` })),
        ...usage.caseStudies.map((c) => ({ category: "Related Content" as const, description: `Used in case study "${c.title}"` })),
        ...usage.templates.map((t) => ({ category: "Related Content" as const, description: `Used in programmatic SEO template "${t.name}"` })),
      ];
      return { success: false, error: `This block is used in ${used} place${used === 1 ? "" : "s"}. Review them and confirm "Delete anyway" to delete it.`, dependencies };
    }
    await prisma.contentBlock.delete({ where: { id } });
    revalidateUsage(usage);
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "ContentBlock",
      entityId: id,
      entityLabel: used > 0 ? `${before.name} (deleted despite ${used} usage${used === 1 ? "" : "s"})` : before.name,
      before: { name: before.name, type: before.type, data: before.data },
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to delete content block ${id}:`, error);
    return { success: false, error: "Failed to delete block" };
  }
}

/**
 * Validates an "Import JSON" payload with the same rules as save (normalizeBlocksInput) and returns the cleaned
 * blocks. Writes nothing: the editor holds the result until the user saves the form, and the save validates again.
 * Lives on the server because the validator pulls in the HTML sanitizer, which the admin browser bundle avoids.
 */
export async function validateBlocksImport(input: unknown): Promise<{ success: true; blocks: { id: string; type: string; data?: unknown; blockId?: string }[] } | { success: false; error: string }> {
  try {
    await requireSession();
    if (!Array.isArray(input) || input.length === 0) return { success: false, error: "Expected a non-empty list of blocks" };
    const result = normalizeBlocksInput(input);
    if (!result.ok) return { success: false, error: result.error };
    return { success: true, blocks: result.value.blocks };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to validate blocks import:", error);
    return { success: false, error: "Couldn't validate the import" };
  }
}

export type ImportValidationResult =
  | {
      success: true;
      blocks: { id: string; type: string; data?: unknown; blockId?: string }[] | null;
      fields: Record<string, unknown>;
      warnings: string[];
      slugConflict: { id: string; title: string; slug: string } | null;
    }
  | { success: false; error: string };

/**
 * Validates a whole "Import JSON" document: a bare block list, or an object with case study form fields plus
 * `blocks`. Writes nothing and never accepts a status — the editor only FILLS THE FORM, and the save action
 * validates everything again. For `target: "caseStudy"` it also reports whether the imported slug is already taken
 * (by another case study than `currentId`), so the admin hears about it before saving rather than from a failed save.
 */
export async function validateImport(input: unknown, options: { target: "blocks" | "caseStudy"; currentId?: string }): Promise<ImportValidationResult> {
  try {
    await requireSession();
    const target = options?.target === "caseStudy" ? "caseStudy" : "blocks";
    const result = validateImportDocument(input, target);
    if (!result.ok) return { success: false, error: result.error };
    let slugConflict: { id: string; title: string; slug: string } | null = null;
    const slug = typeof result.fields.slug === "string" ? slugify(result.fields.slug) : "";
    if (target === "caseStudy" && slug) {
      const existing = await prisma.caseStudy.findUnique({ where: { slug }, select: { id: true, title: true, slug: true } });
      if (existing && existing.id !== options.currentId) slugConflict = existing;
    }
    return { success: true, blocks: result.blocks, fields: result.fields, warnings: result.warnings, slugConflict };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to validate import:", error);
    return { success: false, error: "Couldn't validate the import" };
  }
}
