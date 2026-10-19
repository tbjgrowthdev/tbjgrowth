/**
 * Canonical + hreflang validation.
 *
 * Deterministic, no AI — these are structural/URL checks against data
 * already in the DB, not a judgment call that benefits from a model. Same
 * "why no AI here" reasoning as Content Recommendations/Cannibalization/
 * Health Score.
 *
 * Three things this audits, none of which lib/translation.ts's
 * buildHreflangAlternates can catch on its own since it only ever sees one
 * content item at a time:
 *   1. Malformed canonical overrides (not a real absolute http(s) URL).
 *   2. Duplicate canonical targets — two or more distinct content items
 *      whose EFFECTIVE canonical (override, or their own URL) resolves to
 *      the exact same URL. Sometimes intentional (a deliberate merge before
 *      a redirect goes in), so this is advisory, not an error.
 *   3. Non-reciprocal hreflang — a cross-domain canonical override on
 *      content that still has published translations. Search engines treat
 *      "canonical points elsewhere" and "here are language alternates for
 *      THIS page" as contradictory signals, so this is flagged as a real
 *      problem to fix (remove the override or the translations).
 */

import prisma from "@/lib/prisma";
import { isAbsoluteHttpUrl, isSameOriginUrl } from "@/lib/canonical-validation";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export type CanonicalContentType = "POST" | "CASE_STUDY" | "PAGE" | "SERVICE";

export interface CanonicalCheckItem {
  contentType: CanonicalContentType;
  contentId: string;
  title: string;
  slug: string;
  path: string;
  canonicalUrl: string | null;
}

export interface CanonicalIssue {
  kind: "malformed" | "cross-domain" | "duplicate-target";
  contentType: CanonicalContentType;
  contentId: string;
  title: string;
  path: string;
  detail: string;
  relatedItems?: { contentType: CanonicalContentType; contentId: string; title: string; path: string }[];
}

export interface HreflangIssue {
  kind: "non-reciprocal";
  contentType: CanonicalContentType;
  contentId: string;
  title: string;
  path: string;
  detail: string;
}

export interface CanonicalHreflangReport {
  canonicalIssues: CanonicalIssue[];
  hreflangIssues: HreflangIssue[];
  scannedCount: number;
  scannedAt: string;
}

async function getCheckItems(): Promise<CanonicalCheckItem[]> {
  const [posts, pages, caseStudies, services] = await Promise.all([
    prisma.post.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, canonicalUrl: true } }),
    prisma.page.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, canonicalUrl: true } }),
    prisma.caseStudy.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, canonicalUrl: true } }),
    prisma.agencyService.findMany({ where: { isIndexable: true }, select: { id: true, title: true, slug: true, canonicalUrl: true } }),
  ]);

  return [
    ...posts.map((p) => ({ contentType: "POST" as const, contentId: p.id, title: p.title, slug: p.slug, path: `/blog/${p.slug}`, canonicalUrl: p.canonicalUrl })),
    ...pages.map((p) => ({ contentType: "PAGE" as const, contentId: p.id, title: p.title, slug: p.slug, path: `/${p.slug}`, canonicalUrl: p.canonicalUrl })),
    ...caseStudies.map((c) => ({ contentType: "CASE_STUDY" as const, contentId: c.id, title: c.title, slug: c.slug, path: `/case-studies/${c.slug}`, canonicalUrl: c.canonicalUrl })),
    // AgencyService.slug is nullable — falls back to the fallbackServices
    // placeholder's id-based URL, same fallback services/[slug]/page.tsx uses.
    ...services.map((s) => ({ contentType: "SERVICE" as const, contentId: s.id, title: s.title, slug: s.slug || s.id, path: `/services/${s.slug || s.id}`, canonicalUrl: s.canonicalUrl })),
  ];
}

export async function scanCanonicalAndHreflang(): Promise<CanonicalHreflangReport> {
  const items = await getCheckItems();

  const publishedTranslations = await prisma.contentTranslation.findMany({
    where: { status: "PUBLISHED" },
    select: { contentType: true, contentId: true },
  });
  const hasTranslation = new Set(publishedTranslations.map((t) => `${t.contentType}:${t.contentId}`));

  const canonicalIssues: CanonicalIssue[] = [];
  const hreflangIssues: HreflangIssue[] = [];
  const targetMap = new Map<string, CanonicalCheckItem[]>();

  for (const item of items) {
    const selfUrl = `${baseUrl}${item.path}`;
    let effectiveUrl = selfUrl;

    if (item.canonicalUrl) {
      if (!isAbsoluteHttpUrl(item.canonicalUrl)) {
        canonicalIssues.push({
          kind: "malformed",
          contentType: item.contentType,
          contentId: item.contentId,
          title: item.title,
          path: item.path,
          detail: `Canonical override "${item.canonicalUrl}" is not a valid absolute http(s) URL — browsers/crawlers may ignore it.`,
        });
        // Can't resolve a target for grouping or hreflang comparison below.
        continue;
      }

      effectiveUrl = item.canonicalUrl;
      const sameOrigin = isSameOriginUrl(item.canonicalUrl);

      if (!sameOrigin) {
        canonicalIssues.push({
          kind: "cross-domain",
          contentType: item.contentType,
          contentId: item.contentId,
          title: item.title,
          path: item.path,
          detail: `Canonicalizes to an external domain (${new URL(item.canonicalUrl).hostname}) — confirm this is intentional (e.g. syndicated content).`,
        });

        if (hasTranslation.has(`${item.contentType}:${item.contentId}`)) {
          hreflangIssues.push({
            kind: "non-reciprocal",
            contentType: item.contentType,
            contentId: item.contentId,
            title: item.title,
            path: item.path,
            detail: `This content canonicalizes to an external domain but also has published translations (hreflang alternates). Search engines treat these as contradictory — remove the canonical override or the translations.`,
          });
        }
      }
    }

    const group = targetMap.get(effectiveUrl) ?? [];
    group.push(item);
    targetMap.set(effectiveUrl, group);
  }

  for (const group of targetMap.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const relatedItems = group
        .filter((other) => other !== item)
        .map((other) => ({ contentType: other.contentType, contentId: other.contentId, title: other.title, path: other.path }));
      canonicalIssues.push({
        kind: "duplicate-target",
        contentType: item.contentType,
        contentId: item.contentId,
        title: item.title,
        path: item.path,
        detail: `${group.length} published content items all canonicalize to the same URL. Confirm this consolidation is intentional.`,
        relatedItems,
      });
    }
  }

  return {
    canonicalIssues,
    hreflangIssues,
    scannedCount: items.length,
    scannedAt: new Date().toISOString(),
  };
}
