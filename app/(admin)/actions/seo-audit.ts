"use server";

import { prisma } from "@/lib/prisma";

type Content = {
  id: string;
  title: string;
  slug: string;
  type: "Post" | "Page" | "CaseStudy";
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  content: string | null;
};

async function getAllContent(): Promise<(Content & { path: string })[]> {
  const [posts, pages, cases] = await Promise.all([
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, focusKeyword: true, content: true },
    }),
    prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, focusKeyword: true, content: true },
    }),
    prisma.caseStudy.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, focusKeyword: true, content: true },
    }),
  ]);

  return [
    ...posts.map((p) => ({ ...p, type: "Post" as const, path: `/blog/${p.slug}` })),
    ...pages.map((p) => ({ ...p, type: "Page" as const, path: `/${p.slug}` })),
    ...cases.map((c) => ({ ...c, type: "CaseStudy" as const, path: `/case-studies/${c.slug}` })),
  ] as (Content & { path: string })[];
}

function findDuplicates(items: (Content & { path: string })[], field: "metaTitle" | "metaDescription" | "focusKeyword") {
  const groups = new Map<string, (Content & { path: string })[]>();
  for (const item of items) {
    const value = item[field]?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([value, group]) => ({ value, items: group }));
}

export async function getSeoAudit() {
  const items = await getAllContent();

  const duplicateMetaTitles = findDuplicates(items, "metaTitle");
  const duplicateMetaDescriptions = findDuplicates(items, "metaDescription");
  const duplicateKeywords = findDuplicates(items, "focusKeyword");

  const missingMetaTitle = items.filter((i) => !i.metaTitle?.trim());
  const missingMetaDescription = items.filter((i) => !i.metaDescription?.trim());
  const missingFocusKeyword = items.filter((i) => !i.focusKeyword?.trim());

  const total = items.length || 1;
  const scoreComponents = {
    metaTitleCoverage: (total - missingMetaTitle.length) / total,
    metaDescriptionCoverage: (total - missingMetaDescription.length) / total,
    focusKeywordCoverage: (total - missingFocusKeyword.length) / total,
    noDuplicateTitles: duplicateMetaTitles.length === 0 ? 1 : Math.max(0, 1 - duplicateMetaTitles.length / total),
    noDuplicateDescriptions: duplicateMetaDescriptions.length === 0 ? 1 : Math.max(0, 1 - duplicateMetaDescriptions.length / total),
  };

  const healthScore = Math.round(
    (Object.values(scoreComponents).reduce((sum, v) => sum + v, 0) / Object.keys(scoreComponents).length) * 100
  );

  return {
    totalItems: items.length,
    healthScore,
    duplicateMetaTitles,
    duplicateMetaDescriptions,
    duplicateKeywords,
    missingMetaTitle: missingMetaTitle.map((i) => ({ title: i.title, path: i.path, type: i.type })),
    missingMetaDescription: missingMetaDescription.map((i) => ({ title: i.title, path: i.path, type: i.type })),
    missingFocusKeyword: missingFocusKeyword.map((i) => ({ title: i.title, path: i.path, type: i.type })),
  };
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Compares the public-facing contact fields (shown in the footer/contact page)
 * against the Google Business Profile fields, flagging any mismatch — search
 * engines and Google Business Profile penalize inconsistent NAP (Name/Address/Phone).
 */
export async function getNapConsistency() {
  const settings = await prisma.siteSetting.findFirst();
  if (!settings) {
    return { checked: false, issues: [] as string[] };
  }

  const issues: string[] = [];

  if (settings.phone && settings.gbpPhone && normalize(settings.phone) !== normalize(settings.gbpPhone)) {
    issues.push(`Public phone ("${settings.phone}") doesn't match GBP phone ("${settings.gbpPhone}")`);
  }
  if (settings.address && settings.gbpAddress && normalize(settings.address) !== normalize(settings.gbpAddress)) {
    issues.push(`Public address ("${settings.address}") doesn't match GBP address ("${settings.gbpAddress}")`);
  }
  if (!settings.gbpName) {
    issues.push("GBP business name isn't set — required for accurate LocalBusiness schema markup");
  }

  return { checked: true, issues };
}

/**
 * Extracts internal <a href="..."> links from all published content and checks
 * each unique path for a broken response. Run on-demand (button-triggered) since
 * it makes real HTTP requests — not something to do on every page load.
 */
export async function checkBrokenLinks() {
  const items = await getAllContent();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

  const linkPattern = /href="(\/[^"#]*)"/g;
  const foundPaths = new Set<string>();

  for (const item of items) {
    if (!item.content) continue;
    let match;
    while ((match = linkPattern.exec(item.content)) !== null) {
      foundPaths.add(match[1]);
    }
  }

  const results: { path: string; status: number | "error" }[] = [];
  const paths = Array.from(foundPaths);
  const concurrency = 5;

  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        try {
          const res = await fetch(`${baseUrl}${path}`, { method: "HEAD", redirect: "manual" });
          return { path, status: res.status };
        } catch {
          return { path, status: "error" as const };
        }
      })
    );
    results.push(...batchResults);
  }

  const broken = results.filter((r) => r.status === "error" || (typeof r.status === "number" && r.status >= 400));

  return { checked: results.length, broken };
}
