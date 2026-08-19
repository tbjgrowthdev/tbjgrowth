"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export async function getPages() {
  try {
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
    const slug = slugify(data.slug || data.title);
    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled pages need a publish date" };
    }

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
        schemaJson: data.schemaJson,
        status: data.status || "DRAFT",
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : (data.status === "PUBLISHED" ? new Date() : null),
        isIndexable: data.isIndexable ?? true,
      },
    });
    revalidatePath("/admin/pages");
    return { success: true, data: page };
  } catch (error: any) {
    console.error("Failed to create page:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A page with this slug already exists" };
    }
    return { success: false, error: "Failed to create page" };
  }
}

export async function updatePage(id: string, data: any) {
  try {
    const slug = slugify(data.slug || data.title);
    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled pages need a publish date" };
    }

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
        schemaJson: data.schemaJson,
        status: data.status,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : (data.status === "PUBLISHED" ? new Date() : undefined),
        isIndexable: data.isIndexable ?? true,
      },
    });
    revalidatePath("/admin/pages");
    revalidatePath(`/admin/pages/${id}`);
    // Also revalidate the public page route if it exists
    revalidatePath(`/${slug}`);
    return { success: true, data: page };
  } catch (error: any) {
    console.error("Failed to update page:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A page with this slug already exists" };
    }
    return { success: false, error: "Failed to update page" };
  }
}

export async function deletePage(id: string) {
  try {
    await prisma.page.delete({
      where: { id },
    });
    revalidatePath("/admin/pages");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete page:", error);
    return { success: false, error: "Failed to delete page" };
  }
}
