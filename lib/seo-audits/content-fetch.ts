import prisma from "@/lib/prisma";

export type AuditableContentType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";

export interface AuditableContent {
  contentType: AuditableContentType;
  contentId: string;
  title: string;
  path: string;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string | null;
  // Only POST and CASE_STUDY have a featuredImage/featuredImageAlt field at
  // all — PAGE and SERVICE don't, so hasFeaturedImage is always false and
  // featuredImageAlt always null for those, meaning checkMissingAlt never
  // flags a "missing featured image alt" finding for them (correctly: there
  // is no such field to be missing).
  hasFeaturedImage: boolean;
  featuredImageAlt: string | null;
  isIndexable: boolean;
  schemaJson: string | null;
}

/**
 * Every live content record across all four content types, for the
 * Automated SEO Audits scan. "Live" means PUBLISHED for Post/Page/
 * CaseStudy, or simply existing for AgencyService (which has no draft/
 * publish workflow). Deliberately NOT filtered by isIndexable — a
 * noindexed-but-live page is exactly what the Noindex Issues check needs
 * to see, so excluding it here would hide it from that check entirely.
 */
export async function getAuditableContent(): Promise<AuditableContent[]> {
  const [posts, pages, caseStudies, services] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        content: true,
        featuredImage: true,
        featuredImageAlt: true,
        isIndexable: true,
        schemaJson: true,
      },
    }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true, isIndexable: true, schemaJson: true },
    }),
    prisma.caseStudy.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        slug: true,
        metaTitle: true,
        metaDescription: true,
        content: true,
        featuredImage: true,
        featuredImageAlt: true,
        isIndexable: true,
        schemaJson: true,
      },
    }),
    prisma.agencyService.findMany({
      select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true, isIndexable: true, schemaJson: true },
    }),
  ]);

  return [
    ...posts.map((p) => ({
      contentType: "POST" as const,
      contentId: p.id,
      title: p.title,
      path: `/blog/${p.slug}`,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      content: p.content,
      hasFeaturedImage: !!p.featuredImage,
      featuredImageAlt: p.featuredImageAlt,
      isIndexable: p.isIndexable,
      schemaJson: p.schemaJson,
    })),
    ...pages.map((p) => ({
      contentType: "PAGE" as const,
      contentId: p.id,
      title: p.title,
      path: `/${p.slug}`,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      content: p.content,
      hasFeaturedImage: false,
      featuredImageAlt: null,
      isIndexable: p.isIndexable,
      schemaJson: p.schemaJson,
    })),
    ...caseStudies.map((c) => ({
      contentType: "CASE_STUDY" as const,
      contentId: c.id,
      title: c.title,
      path: `/case-studies/${c.slug}`,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      content: c.content,
      hasFeaturedImage: !!c.featuredImage,
      featuredImageAlt: c.featuredImageAlt,
      isIndexable: c.isIndexable,
      schemaJson: c.schemaJson,
    })),
    // Services without a slug are the fallbackServices placeholders with no
    // real DB-backed public page — excluded, same as sitemap/canonical scans.
    ...services
      .filter((s) => s.slug)
      .map((s) => ({
        contentType: "SERVICE" as const,
        contentId: s.id,
        title: s.title,
        path: `/services/${s.slug}`,
        metaTitle: s.metaTitle,
        metaDescription: s.metaDescription,
        content: s.content,
        hasFeaturedImage: false,
        featuredImageAlt: null,
        isIndexable: s.isIndexable,
        schemaJson: s.schemaJson,
      })),
  ];
}
