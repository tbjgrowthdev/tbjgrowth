"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { TRANSITIONS, transitionContent, type WorkflowAction } from "@/lib/workflow";
import { guardMutation } from "@/lib/action-guard";
import { logAudit } from "@/lib/audit-log";
import { recordVersion } from "@/lib/versioning";
import { checkStale } from "@/lib/stale-check";
import { sanitizeRichText } from "@/lib/sanitize";
import { normalizeBlocksInput } from "@/lib/blocks/schema";
import { checkDeleteDependencies, deleteAuditLabel, type DeleteOptions } from "@/lib/dependency-check";

// SEO fields here are read back out by lib/seo-change-log to build the SEO
// Change Impact log, so keep this in parity with SEO_CHANGE_FIELDS.
function pageSnapshot(page: any) {
  return {
    title: page.title,
    slug: page.slug,
    status: page.status,
    isIndexable: page.isIndexable,
    allowFollow: page.allowFollow,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    focusKeyword: page.focusKeyword,
    secondaryKeywords: page.secondaryKeywords,
    canonicalUrl: page.canonicalUrl,
    schemaJson: page.schemaJson,
    ogImage: page.ogImage,
    twitterCard: page.twitterCard,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    twitterTitle: page.twitterTitle,
    twitterDescription: page.twitterDescription,
    twitterImage: page.twitterImage,
    maxSnippet: page.maxSnippet,
    maxImagePreview: page.maxImagePreview,
    maxVideoPreview: page.maxVideoPreview,
    authorId: page.authorId,
    reviewerId: page.reviewerId,
    seoReviewerId: page.seoReviewerId,
    approverId: page.approverId,
    publishedAt: page.publishedAt,
    blocks: page.blocks,
  };
}

// `blocks` is only written when the caller sent it, so older callers (and the
// classic editor) can never wipe a page's layout by omission. An empty list
// becomes null = classic rich-text page. Validation and HTML sanitizing live in
// lib/blocks/schema.ts.
function blocksUpdate(input: unknown): { ok: true; data: { blocks?: string | null } } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, data: {} };
  const result = normalizeBlocksInput(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { blocks: result.value.json } };
}

export async function getPages() {
  try {
    await requireSession();
    return await prisma.page.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch pages:", error);
    return [];
  }
}

export async function getPage(id: string) {
  try {
    await requireSession();
    return await prisma.page.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to fetch page:", error);
    return null;
  }
}

export async function createPage(data: any) {
  try {
    const session = await requirePermission("CREATE");
    const slug = slugify(data.slug || data.title);
    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    const blocks = blocksUpdate(data.blocks);
    if (!blocks.ok) return { success: false, error: blocks.error };

    // Always starts as a draft — status only moves via the workflow
    // transitions (transitionPage), which check PUBLISH/SCHEDULE/APPROVE.
    const page = await prisma.page.create({
      data: {
        title: data.title,
        slug,
        content: sanitizeRichText(data.content),
        ...blocks.data,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
        secondaryKeywords: data.secondaryKeywords,
        canonicalUrl: data.canonicalUrl,
        twitterCard: data.twitterCard,
        ogImage: data.ogImage,
        ogTitle: data.ogTitle,
        ogDescription: data.ogDescription,
        twitterTitle: data.twitterTitle,
        twitterDescription: data.twitterDescription,
        twitterImage: data.twitterImage,
        schemaJson: data.schemaJson,
        status: "DRAFT",
        isIndexable: data.isIndexable ?? true,
        allowFollow: data.allowFollow ?? true,
        maxSnippet: data.maxSnippet ?? -1,
        maxImagePreview: data.maxImagePreview || "large",
        maxVideoPreview: data.maxVideoPreview ?? -1,
      },
    });
    revalidatePath("/admin/pages");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Page",
      entityId: page.id,
      entityLabel: page.title,
      after: pageSnapshot(page),
    });
    await recordVersion(
      "PAGE",
      page.id,
      page,
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary || "Initial version"
    );
    return { success: true, data: page };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create page:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A page with this slug already exists" };
    }
    return { success: false, error: "Failed to create page" };
  }
}

export async function updatePage(id: string, data: any) {
  try {
    const session = await requirePermission("EDIT");
    const slug = slugify(data.slug || data.title);
    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    const before = await prisma.page.findUnique({ where: { id } });
    if (!before) {
      return { success: false, error: "Page not found" };
    }
    const staleError = checkStale(data.expectedUpdatedAt, before.updatedAt);
    if (staleError) {
      return { success: false, error: staleError, stale: true };
    }

    const blocks = blocksUpdate(data.blocks);
    if (!blocks.ok) return { success: false, error: blocks.error };

    const page = await prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        content: sanitizeRichText(data.content),
        ...blocks.data,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
        secondaryKeywords: data.secondaryKeywords,
        canonicalUrl: data.canonicalUrl,
        twitterCard: data.twitterCard,
        ogImage: data.ogImage,
        ogTitle: data.ogTitle,
        ogDescription: data.ogDescription,
        twitterTitle: data.twitterTitle,
        twitterDescription: data.twitterDescription,
        twitterImage: data.twitterImage,
        schemaJson: data.schemaJson,
        isIndexable: data.isIndexable ?? true,
        allowFollow: data.allowFollow ?? true,
        maxSnippet: data.maxSnippet ?? -1,
        maxImagePreview: data.maxImagePreview || "large",
        maxVideoPreview: data.maxVideoPreview ?? -1,
      },
    });
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${id}`);
    revalidatePath(`/${slug}`);
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Page",
      entityId: page.id,
      entityLabel: page.title,
      before: before ? pageSnapshot(before) : undefined,
      after: pageSnapshot(page),
    });
    await recordVersion(
      "PAGE",
      page.id,
      page,
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary
    );
    return { success: true, data: page };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update page:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A page with this slug already exists" };
    }
    return { success: false, error: "Failed to update page" };
  }
}

// Blocked when other content depends on this item, unless options.force is
// set (the UI passes it after showing the list). See checkDeleteDependencies.
export async function deletePage(id: string, options?: DeleteOptions) {
  try {
    await requirePermission("DELETE");
    const { blocked, dependencies } = await checkDeleteDependencies("PAGE", id, options);
    if (blocked) return blocked;
    const before = await prisma.page.findUnique({ where: { id } });
    await prisma.page.delete({
      where: { id },
    });
    revalidatePath("/admin/pages");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Page",
      entityId: id,
      entityLabel: deleteAuditLabel(before?.title, dependencies),
      before: before ? pageSnapshot(before) : undefined,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to delete page:", error);
    return { success: false, error: "Failed to delete page" };
  }
}

export async function transitionPage(id: string, action: WorkflowAction, comment?: string) {
  const permission = TRANSITIONS[action]?.permission;
  if (!permission) return { success: false as const, error: `Unknown workflow action "${action}"` };
  return guardMutation(permission, () => transitionContent("PAGE", id, action, comment));
}
