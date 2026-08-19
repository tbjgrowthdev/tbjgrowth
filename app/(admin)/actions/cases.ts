"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export async function getCaseStudies() {
  try {
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
    const session = await getServerSession(authOptions);
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled case studies need a publish date" };
    }

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
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
        imageGallery: data.imageGallery || [],
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
        isFeatured: data.isFeatured ?? false,
        authorId: session?.user?.id,
      },
    });
    revalidatePath("/admin/cases");
    revalidatePath("/case-studies");
    revalidatePath("/");
    return { success: true, data: caseStudy };
  } catch (error: any) {
    console.error("Failed to create case study:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A case study with this slug already exists" };
    }
    return { success: false, error: "Failed to create case study" };
  }
}

export async function updateCaseStudy(id: string, data: any) {
  try {
    const slug = slugify(data.slug || data.title);

    if (!slug) {
      return { success: false, error: "Slug cannot be empty" };
    }
    if (data.status === "SCHEDULED" && !data.publishedAt) {
      return { success: false, error: "Scheduled case studies need a publish date" };
    }

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
        featuredImage: data.featuredImage,
        featuredImageAlt: data.featuredImageAlt,
        imageGallery: data.imageGallery || [],
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
        isFeatured: data.isFeatured ?? false,
      },
    });
    revalidatePath("/admin/cases");
    revalidatePath(`/admin/cases/${id}`);
    revalidatePath("/case-studies");
    revalidatePath(`/case-studies/${slug}`);
    revalidatePath("/");
    return { success: true, data: caseStudy };
  } catch (error: any) {
    console.error("Failed to update case study:", error);
    if (error.code === "P2002") {
      return { success: false, error: "A case study with this slug already exists" };
    }
    return { success: false, error: "Failed to update case study" };
  }
}

export async function deleteCaseStudy(id: string) {
  try {
    await prisma.caseStudy.delete({
      where: { id },
    });
    revalidatePath("/admin/cases");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete case study:", error);
    return { success: false, error: "Failed to delete case study" };
  }
}
