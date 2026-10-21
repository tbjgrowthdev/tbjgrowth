/**
 * Shared sitemap entry-building + XML rendering, used by every sitemap route
 * (app/sitemap.xml, app/sitemap-{static,pages,posts,case-studies,services}.xml).
 * Split into one index + five content-specific child sitemaps instead of one
 * giant combined file — each child can be submitted/monitored independently
 * in Search Console, and a site with thousands of posts never risks hitting
 * a single sitemap's 50,000-URL/50MB limit.
 *
 * Every route built on this is `export const dynamic = "force-dynamic"` and
 * queries the DB live on every request — there is no cache layer sitting in
 * front of them, so "auto-update on publish/update/delete" is inherent, not
 * something extra to wire up: the moment a row's status/slug/isIndexable
 * changes, the very next sitemap request reflects it.
 */
import prisma from "@/lib/prisma";
import { LOCALES, PREFIXED_LOCALES } from "@/lib/i18n";
import { buildHreflangAlternates, type TranslatableKind } from "@/lib/translation";

export const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapUrlEntry {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
  languages?: Record<string, string>;
}

// The public path a published Post/Page/CaseStudy lives at — the single
// source of truth also used by lib/workflow.ts and lib/scheduled-jobs.ts to
// know what URL to notify search engines about on publish.
export const PUBLIC_PATH_BUILDERS: Record<"POST" | "PAGE" | "CASE_STUDY", (slug: string) => string> = {
  POST: (slug: string) => `/blog/${slug}`,
  PAGE: (slug: string) => `/${slug}`,
  CASE_STUDY: (slug: string) => `/case-studies/${slug}`,
};

const STATIC_ROUTES: [string, number, ChangeFrequency][] = [
  ["", 1, "weekly"],
  ["/about", 0.8, "weekly"],
  ["/services", 0.8, "weekly"],
  ["/contact", 0.8, "weekly"],
  ["/blog", 0.8, "weekly"],
  ["/case-studies", 0.8, "weekly"],
  ["/pricing", 0.8, "weekly"],
  ["/book-a-call", 0.8, "weekly"],
];

// Static marketing routes (home/about/services list/etc.) always render in
// every locale — their body is a hardcoded component, never gated on a
// translation existing — so every locale variant is always a legitimate
// sitemap entry, cross-referencing every other locale's URL for the same
// page via hreflang.
function staticRouteEntries(path: string, priority: number, changeFrequency: ChangeFrequency): SitemapUrlEntry[] {
  const canonical = `${baseUrl}${path === "/" ? "" : path}`;
  const languages: Record<string, string> = { "en-GB": canonical, "x-default": canonical };
  for (const locale of PREFIXED_LOCALES) {
    languages[locale.code] = `${baseUrl}/${locale.prefix}${path === "/" ? "" : path}`;
  }
  const entries: SitemapUrlEntry[] = [{ url: canonical, lastModified: new Date(), changeFrequency, priority, languages }];
  for (const locale of PREFIXED_LOCALES) {
    entries.push({ url: languages[locale.code], lastModified: new Date(), changeFrequency, priority, languages });
  }
  return entries;
}

// Real per-record detail routes: the base (en-GB) URL is always listed;
// en-BD/en-AE are always listed too (same-language fallback content);
// bn-BD/ar-AE are listed only when buildHreflangAlternates finds a
// PUBLISHED translation — never advertise a URL that would 404.
async function contentEntries(
  contentType: TranslatableKind,
  id: string,
  slug: string,
  pathBuilder: (slug: string) => string,
  updatedAt: Date,
  priority: number,
  changeFrequency: ChangeFrequency
): Promise<SitemapUrlEntry[]> {
  const { languages } = await buildHreflangAlternates(contentType, id, slug, pathBuilder);
  return Object.entries(languages)
    .filter(([key]) => key !== "x-default")
    .map(([, url]) => ({ url, lastModified: updatedAt, changeFrequency, priority, languages }));
}

export function getStaticEntries(): SitemapUrlEntry[] {
  return STATIC_ROUTES.flatMap(([path, priority, freq]) => staticRouteEntries(path, priority, freq));
}

export async function getPageEntries(): Promise<SitemapUrlEntry[]> {
  const pages = await prisma.page.findMany({
    where: { status: "PUBLISHED", isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  });
  return (
    await Promise.all(pages.map((p) => contentEntries("PAGE", p.id, p.slug, PUBLIC_PATH_BUILDERS.PAGE, p.updatedAt, 0.8, "weekly")))
  ).flat();
}

export async function getPostEntries(): Promise<SitemapUrlEntry[]> {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  });
  return (
    await Promise.all(posts.map((p) => contentEntries("POST", p.id, p.slug, PUBLIC_PATH_BUILDERS.POST, p.updatedAt, 0.6, "weekly")))
  ).flat();
}

export async function getCaseStudyEntries(): Promise<SitemapUrlEntry[]> {
  const caseStudies = await prisma.caseStudy.findMany({
    where: { status: "PUBLISHED", isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  });
  return (
    await Promise.all(
      caseStudies.map((c) => contentEntries("CASE_STUDY", c.id, c.slug, PUBLIC_PATH_BUILDERS.CASE_STUDY, c.updatedAt, 0.7, "monthly"))
    )
  ).flat();
}

// Only real DB-backed, indexable services; the placeholder fallback
// services shown before any are added are never real routes meant for
// indexing, so they're deliberately excluded.
export async function getServiceEntries(): Promise<SitemapUrlEntry[]> {
  const services = await prisma.agencyService.findMany({
    where: { isIndexable: true, slug: { not: null } },
    select: { id: true, slug: true, updatedAt: true },
  });
  return (
    await Promise.all(
      services.map((s) => contentEntries("SERVICE", s.id, s.slug!, (slug) => `/services/${slug}`, s.updatedAt, 0.7, "monthly"))
    )
  ).flat();
}

// Only pages that actually render publicly (see the matching gate in
// app/(public)/[locale]/pSEO/[slug]/page.tsx) and whose template hasn't
// been switched off — a NEEDS_REVIEW page was never meant to be found,
// let alone submitted to Search Console.
export async function getPSeoEntries(): Promise<SitemapUrlEntry[]> {
  const pages = await prisma.pSeoPage.findMany({
    where: { status: { in: ["PUBLISHED", "OVERRIDDEN"] }, template: { isIndexable: true } },
    select: { slug: true, updatedAt: true },
  });
  return pages.map((p) => ({ url: `${baseUrl}/pSEO/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as ChangeFrequency, priority: 0.5 }));
}

// Locations aren't a TranslatableKind (see lib/translation.ts) — there's no
// per-locale translation row to check for, so this doesn't go through
// contentEntries()/buildHreflangAlternates. Instead a location is only ever
// a legitimate sitemap entry under the locales that share its own market
// (the same gating app/(public)/[locale]/locations/[slug]/page.tsx
// enforces as a 404) — a Dhaka office has no en-GB or ar-AE URL to list.
export async function getLocationEntries(): Promise<SitemapUrlEntry[]> {
  const locations = await prisma.location.findMany({
    where: { isIndexable: true },
    select: { slug: true, market: true, updatedAt: true },
  });

  return locations.flatMap((location) => {
    const marketLocales = LOCALES.filter((l) => l.market === location.market);
    const languages: Record<string, string> = {};
    for (const l of marketLocales) {
      languages[l.code] = l.prefix ? `${baseUrl}/${l.prefix}/locations/${location.slug}` : `${baseUrl}/locations/${location.slug}`;
    }
    return marketLocales.map((l) => ({
      url: languages[l.code],
      lastModified: location.updatedAt,
      changeFrequency: "monthly" as ChangeFrequency,
      priority: 0.7,
      languages,
    }));
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlsetXml(entries: SitemapUrlEntry[]): string {
  const urls = entries
    .map((e) => {
      const alternates = e.languages
        ? Object.entries(e.languages)
            .map(([hreflang, href]) => `<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`)
            .join("")
        : "";
      return `<url><loc>${escapeXml(e.url)}</loc><lastmod>${e.lastModified.toISOString()}</lastmod><changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority>${alternates}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}

export function renderSitemapIndexXml(sitemaps: { url: string; lastModified: Date }[]): string {
  const items = sitemaps
    .map((s) => `<sitemap><loc>${escapeXml(s.url)}</loc><lastmod>${s.lastModified.toISOString()}</lastmod></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}
