"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export async function getPosts() {
  try {
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
    const session = await getServerSession(authOptions);
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled posts need a publish date" };
    }

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
        schemaJson: data.schemaJson,
        status: data.status || "DRAFT",
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : (data.status === "PUBLISHED" ? new Date() : null),
        isIndexable: data.isIndexable ?? true,
        authorId: session?.user?.id,
        categories: data.categoryIds?.length ? { connect: data.categoryIds.map((id: string) => ({ id })) } : undefined,
        tags: data.tagIds?.length ? { connect: data.tagIds.map((id: string) => ({ id })) } : undefined,
      },
    });
    revalidatePath("/admin/posts");
    revalidatePath("/blog");
    return { success: true, data: post };
  } catch (error: any) {
    console.error("Failed to create post:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A post with this slug already exists" };
    }
    return { success: false, error: "Failed to create post" };
  }
}

export async function updatePost(id: string, data: any) {
  try {
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled posts need a publish date" };
    }

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
        schemaJson: data.schemaJson,
        status: data.status,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : (data.status === "PUBLISHED" ? new Date() : undefined),
        isIndexable: data.isIndexable ?? true,
        categories: data.categoryIds ? { set: data.categoryIds.map((id: string) => ({ id })) } : undefined,
        tags: data.tagIds ? { set: data.tagIds.map((id: string) => ({ id })) } : undefined,
      },
    });
    revalidatePath("/admin/posts");
    revalidatePath(`/admin/posts/${id}`);
    revalidatePath("/blog");
    revalidatePath(`/blog/${slug}`);
    return { success: true, data: post };
  } catch (error: any) {
    console.error("Failed to update post:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A post with this slug already exists" };
    }
    return { success: false, error: "Failed to update post" };
  }
}

export async function deletePost(id: string) {
  try {
    await prisma.post.delete({
      where: { id },
    });
    revalidatePath("/admin/posts");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete post:", error);
    return { success: false, error: "Failed to delete post" };
  }
}
