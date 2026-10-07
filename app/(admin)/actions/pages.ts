"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { transitionContent, type WorkflowAction } from "@/lib/workflow";
import { logAudit } from "@/lib/audit-log";
import { recordVersion } from "@/lib/versioning";

function pageSnapshot(page: any) {
  return {
    title: page.title,
    slug: page.slug,
    status: page.status,
    isIndexable: page.isIndexable,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    authorId: page.authorId,
    reviewerId: page.reviewerId,
    seoReviewerId: page.seoReviewerId,
    approverId: page.approverId,
    publishedAt: page.publishedAt,
  };
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

    // Always starts as a draft — status only moves via the workflow
    // transitions (transitionPage), which check PUBLISH/SCHEDULE/APPROVE.
    const page = await prisma.page.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
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

    const page = await prisma.page.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        content: data.content,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        focusKeyword: data.focusKeyword,
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

export async function deletePage(id: string) {
  try {
    await requirePermission("DELETE");
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
      entityLabel: before?.title,
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
  return transitionContent("PAGE", id, action, comment);
}
