import type { Metadata } from "next";
import prisma from "@/lib/prisma";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

/**
 * Looks up a `Page` record by a reserved slug (e.g. "home", "about") and, if
 * published, builds Next.js Metadata from its SEO fields. Lets admins control
 * SEO for hardcoded marketing routes without touching their visual content.
 * Falls back to the provided defaults when no override page exists.
 */
export async function getPageMetadata(
  slug: string,
  fallback: { title: string; description: string; path: string }
): Promise<Metadata> {
  const canonicalPath = fallback.path;
  const canonical = `${baseUrl}${canonicalPath === "/" ? "" : canonicalPath}`;

  let page = null;
  try {
    page = await prisma.page.findUnique({ where: { slug } });
  } catch (error) {
    console.error(`Failed to fetch SEO override page for slug "${slug}":`, error);
  }

  if (!page || page.status !== "PUBLISHED") {
    return {
      title: fallback.title,
      description: fallback.description,
      alternates: {
        canonical,
        languages: { "en-GB": canonical },
      },
    };
  }

  const title = page.metaTitle || fallback.title;
  const description = page.metaDescription || fallback.description;
  const canonicalUrl = page.canonicalUrl || canonical;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: { "en-GB": canonicalUrl },
    },
    robots: {
      index: page.isIndexable,
      follow: true,
    },
    openGraph: {
      title,
      description,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
    twitter: {
      card: (page.twitterCard as "summary" | "summary_large_image") || "summary_large_image",
    },
  };
}

/** Prisma `where` clause fragment: visible if PUBLISHED, or SCHEDULED with a past publish date. */
export const publiclyVisible = {
  OR: [
    { status: "PUBLISHED" as const },
    { status: "SCHEDULED" as const, publishedAt: { lte: new Date() } },
  ],
};
