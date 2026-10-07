"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { transitionContent, type WorkflowAction } from "@/lib/workflow";
import { logAudit } from "@/lib/audit-log";
import { recordVersion } from "@/lib/versioning";

function caseStudySnapshot(cs: any) {
  return {
    title: cs.title,
    slug: cs.slug,
    status: cs.status,
    isIndexable: cs.isIndexable,
    isFeatured: cs.isFeatured,
    metaTitle: cs.metaTitle,
    metaDescription: cs.metaDescription,
    authorId: cs.authorId,
    reviewerId: cs.reviewerId,
    seoReviewerId: cs.seoReviewerId,
    approverId: cs.approverId,
    publishedAt: cs.publishedAt,
  };
}

export async function getCaseStudies() {
  try {
    await requireSession();
    return await prisma.caseStudy.findMany({
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch case studies:", error);
    return [];
  }
}

export async function getCaseStudy(id: string) {
  try {
    return await prisma.caseStudy.findUnique({
      where: { id },
    });
  } catch (error) {
    console.error("Failed to fetch case study:", error);
    return null;
  }
}

/** Published case studies flagged to show on the home page, most recent first. */
export async function getFeaturedCaseStudies(limit = 6) {
  try {
    return await prisma.caseStudy.findMany({
      where: { isFeatured: true, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
  } catch (error) {
    console.error("Failed to fetch featured case studies:", error);
    return [];
  }
}

export async function createCaseStudy(data: any) {
  try {
    const session = await requirePermission("CREATE");
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    // Always starts as a draft — status only moves via transitionCaseStudy,
    // which checks PUBLISH/SCHEDULE/APPROVE.
    const caseStudy = await prisma.caseStudy.create({
      data: {
        title: data.title,
        slug,
        clientName: data.clientName,
        industry: data.industry,
        serviceType: data.serviceType,
        results: data.results,
        content: data.content,
        excerpt: data.excerpt,
        websiteUrl: data.websiteUrl || null,
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
        imageGallery: data.imageGallery || [],
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
        isFeatured: data.isFeatured ?? false,
        authorId: session.user.id,
      },
    });
    revalidatePath("/admin/cases");
    revalidatePath("/case-studies");
    revalidatePath("/");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "CaseStudy",
      entityId: caseStudy.id,
      entityLabel: caseStudy.title,
      after: caseStudySnapshot(caseStudy),
    });
    await recordVersion(
      "CASE_STUDY",
      caseStudy.id,
      caseStudy,
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary || "Initial version"
    );
    return { success: true, data: caseStudy };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create case study:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A case study with this slug already exists" };
    }
    return { success: false, error: "Failed to create case study" };
  }
}

export async function updateCaseStudy(id: string, data: any) {
  try {
    const session = await requirePermission("EDIT");
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    const before = await prisma.caseStudy.findUnique({ where: { id } });

    const caseStudy = await prisma.caseStudy.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        clientName: data.clientName,
        industry: data.industry,
        serviceType: data.serviceType,
        results: data.results,
        content: data.content,
        excerpt: data.excerpt,
        websiteUrl: data.websiteUrl || null,
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
        imageGallery: data.imageGallery || [],
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
        isFeatured: data.isFeatured ?? false,
      },
    });
    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${id}`);
    revalidatePath("/case-studies");
    revalidatePath(`/case-studies/${slug}`);
    revalidatePath("/");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "CaseStudy",
      entityId: caseStudy.id,
      entityLabel: caseStudy.title,
      before: before ? caseStudySnapshot(before) : undefined,
      after: caseStudySnapshot(caseStudy),
    });
    await recordVersion(
      "CASE_STUDY",
      caseStudy.id,
      caseStudy,
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary
    );
    return { success: true, data: caseStudy };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update case study:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A case study with this slug already exists" };
    }
    return { success: false, error: "Failed to update case study" };
  }
}

export async function deleteCaseStudy(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.caseStudy.findUnique({ where: { id } });
    await prisma.caseStudy.delete({
      where: { id },
    });
    revalidatePath("/admin/cases");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "CaseStudy",
      entityId: id,
      entityLabel: before?.title,
      before: before ? caseStudySnapshot(before) : undefined,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to delete case study:", error);
    return { success: false, error: "Failed to delete case study" };
  }
}

export async function transitionCaseStudy(id: string, action: WorkflowAction, comment?: string) {
  return transitionContent("CASE_STUDY", id, action, comment);
}
