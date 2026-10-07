"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { transitionContent, type WorkflowAction } from "@/lib/workflow";
import { logAudit } from "@/lib/audit-log";
import { recordVersion } from "@/lib/versioning";

// Metadata only — excludes content/schemaJson so the audit log doesn't bloat.
function postSnapshot(post: any) {
  return {
    title: post.title,
    slug: post.slug,
    status: post.status,
    isIndexable: post.isIndexable,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    authorId: post.authorId,
    reviewerId: post.reviewerId,
    seoReviewerId: post.seoReviewerId,
    approverId: post.approverId,
    publishedAt: post.publishedAt,
  };
}

export async function getPosts() {
  try {
    await requireSession();
    return await prisma.post.findMany({
      include: { author: true, categories: true },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return [];
  }
}

export async function getPost(id: string) {
  try {
    await requireSession();
    return await prisma.post.findUnique({
      where: { id },
      include: { categories: true, tags: true },
    });
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return null;
  }
}

export async function createPost(data: any) {
  try {
    const session = await requirePermission("CREATE");
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    // Content always starts as a draft, including AI-assisted drafts — the
    // caller's requested status is never trusted directly; it only reaches
    // PUBLISHED/SCHEDULED/APPROVED through the workflow transitions below,
    // which check the matching permission (PUBLISH/SCHEDULE/APPROVE) first.
    const post = await prisma.post.create({
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
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
        authorId: session.user.id,
        categories: data.categoryIds?.length ? { connect: data.categoryIds.map((id: string) => ({ id })) } : undefined,
        tags: data.tagIds?.length ? { connect: data.tagIds.map((id: string) => ({ id })) } : undefined,
      },
    });
    revalidatePath("/admin/posts");
    revalidatePath("/blog");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "Post",
      entityId: post.id,
      entityLabel: post.title,
      after: postSnapshot(post),
    });
    await recordVersion(
      "POST",
      post.id,
      { ...post, categories: (data.categoryIds || []).map((id: string) => ({ id })), tags: (data.tagIds || []).map((id: string) => ({ id })) },
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary || "Initial version"
    );
    return { success: true, data: post };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to create post:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A post with this slug already exists" };
    }
    return { success: false, error: "Failed to create post" };
  }
}

export async function updatePost(id: string, data: any) {
  try {
    const session = await requirePermission("EDIT");
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }

    const before = await prisma.post.findUnique({ where: { id } });

    // Status moves through transitionContent()/the workflow actions below,
    // not through this general-purpose save — editing content never changes
    // its lifecycle stage as a side effect.
    const post = await prisma.post.update({
      where: { id },
      data: {
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
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
        categories: data.categoryIds ? { set: data.categoryIds.map((id: string) => ({ id })) } : undefined,
        tags: data.tagIds ? { set: data.tagIds.map((id: string) => ({ id })) } : undefined,
      },
    });
    revalidatePath("/admin/posts");
    revalidatePath(`/admin/posts/${id}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "Post",
      entityId: post.id,
      entityLabel: post.title,
      before: before ? postSnapshot(before) : undefined,
      after: postSnapshot(post),
    });
    await recordVersion(
      "POST",
      post.id,
      { ...post, categories: (data.categoryIds || []).map((id: string) => ({ id })), tags: (data.tagIds || []).map((id: string) => ({ id })) },
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      data.changeSummary
    );
    return { success: true, data: post };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to update post:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A post with this slug already exists" };
    }
    return { success: false, error: "Failed to update post" };
  }
}

export async function deletePost(id: string) {
  try {
    await requirePermission("DELETE");
    const before = await prisma.post.findUnique({ where: { id } });
    await prisma.post.delete({
      where: { id },
    });
    revalidatePath("/admin/posts");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "Post",
      entityId: id,
      entityLabel: before?.title,
      before: before ? postSnapshot(before) : undefined,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to delete post:", error);
    return { success: false, error: "Failed to delete post" };
  }
}

export async function transitionPost(id: string, action: WorkflowAction, comment?: string) {
  return transitionContent("POST", id, action, comment);
}
