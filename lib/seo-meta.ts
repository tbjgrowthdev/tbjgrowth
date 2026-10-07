import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { getSiteSettings } from "@/app/(admin)/actions/settings";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

/**
 * Builds a complete, explicit robots directive instead of leaving max-snippet/
 * max-image-preview/max-video-preview to search engines' implicit defaults.
 * Indexable production content gets unrestricted rich-result previews (what a
 * marketing site wants); noindex content gets a plain noindex/nofollow with no
 * preview directives, since those are moot once a page is excluded anyway.
 */
export function buildRobotsMeta(indexable: boolean): NonNullable<Metadata["robots"]> {
  if (!indexable) {
    return { index: false, follow: false };
  }
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  };
}

/**
 * Resolves per-content OpenGraph/Twitter overrides against a cascade of
 * fallbacks, so every piece of content always produces usable social tags
 * even when an admin hasn't filled in the dedicated OG/Twitter fields:
 *   OG title/description  -> metaTitle/metaDescription -> base title/description
 *   OG image               -> content's own image (e.g. featuredImage) -> site default
 *   Twitter title/desc/img -> the resolved OG title/description/image above
 */
export function resolveSocialMeta(input: {
  baseTitle: string;
  baseDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  twitterCard?: string | null;
  fallbackImage?: string | null;
  siteDefaultImage?: string | null;
}) {
  const baseTitle = input.metaTitle || input.baseTitle;
  const baseDescription = input.metaDescription || input.baseDescription || undefined;

  const ogTitle = input.ogTitle || baseTitle;
  const ogDescription = input.ogDescription || baseDescription;
  const ogImage = input.ogImage || input.fallbackImage || input.siteDefaultImage || undefined;

  const twitterTitle = input.twitterTitle || ogTitle;
  const twitterDescription = input.twitterDescription || ogDescription;
  const twitterImage = input.twitterImage || ogImage;

  return {
    title: baseTitle,
    description: baseDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: (input.twitterCard as "summary" | "summary_large_image") || "summary_large_image",
      title: twitterTitle,
      description: twitterDescription,
      images: twitterImage ? [twitterImage] : undefined,
    },
  };
}

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
      robots: buildRobotsMeta(true),
    };
  }

  const canonicalUrl = page.canonicalUrl || canonical;

  const settings = await getSiteSettings();
  const defaultOgImage = settings?.defaultOgImage || null;

  const social = resolveSocialMeta({
    baseTitle: fallback.title,
    baseDescription: fallback.description,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    ogImage: page.ogImage,
    twitterTitle: page.twitterTitle,
    twitterDescription: page.twitterDescription,
    twitterImage: page.twitterImage,
    twitterCard: page.twitterCard,
    siteDefaultImage: defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: {
      canonical: canonicalUrl,
      languages: { "en-GB": canonicalUrl },
    },
    robots: buildRobotsMeta(page.isIndexable),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

/** Prisma `where` clause fragment: visible if PUBLISHED, or SCHEDULED with a past publish date. */
export const publiclyVisible = {
  OR: [
    { status: "PUBLISHED" as const },
    { status: "SCHEDULED" as const, publishedAt: { lte: new Date() } },
  ],
};
