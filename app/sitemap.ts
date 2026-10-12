import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PREFIXED_LOCALES } from '@/lib/i18n'
import { buildHreflangAlternates, type TranslatableKind } from '@/lib/translation'

export const dynamic = 'force-dynamic'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tbjgrowth.com'

type SitemapEntry = MetadataRoute.Sitemap[number]

// Static marketing routes (home/about/services list/etc.) always render in
// every locale — their body is a hardcoded component, never gated on a
// translation existing — so every locale variant is always a legitimate
// sitemap entry, cross-referencing every other locale's URL for the same
// page via hreflang.
function staticRouteEntries(path: string, priority: number, changeFrequency: SitemapEntry['changeFrequency']): SitemapEntry[] {
  const canonical = `${baseUrl}${path === '/' ? '' : path}`
  const languages: Record<string, string> = { 'en-GB': canonical, 'x-default': canonical }
  for (const locale of PREFIXED_LOCALES) {
    languages[locale.code] = `${baseUrl}/${locale.prefix}${path === '/' ? '' : path}`
  }
  const entries: SitemapEntry[] = [{ url: canonical, lastModified: new Date(), changeFrequency, priority, alternates: { languages } }]
  for (const locale of PREFIXED_LOCALES) {
    entries.push({
      url: languages[locale.code],
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: { languages },
    })
  }
  return entries
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
  changeFrequency: SitemapEntry['changeFrequency']
): Promise<SitemapEntry[]> {
  const { languages } = await buildHreflangAlternates(contentType, id, slug, pathBuilder)
  return Object.entries(languages)
    .filter(([key]) => key !== 'x-default')
    .map(([, url]) => ({ url, lastModified: updatedAt, changeFrequency, priority, alternates: { languages } }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    ['', 1, 'weekly'],
    ['/about', 0.8, 'weekly'],
    ['/services', 0.8, 'weekly'],
    ['/contact', 0.8, 'weekly'],
    ['/blog', 0.8, 'weekly'],
    ['/case-studies', 0.8, 'weekly'],
    ['/pricing', 0.8, 'weekly'],
    ['/book-a-call', 0.8, 'weekly'],
  ].flatMap(([path, priority, freq]) => staticRouteEntries(path as string, priority as number, freq as SitemapEntry['changeFrequency']))

  // Dynamic Pages
  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  })
  const pageRoutes = (
    await Promise.all(pages.map((p) => contentEntries('PAGE', p.id, p.slug, (s) => `/${s}`, p.updatedAt, 0.8, 'weekly')))
  ).flat()

  // Dynamic Blog Posts
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  })
  const postRoutes = (
    await Promise.all(posts.map((p) => contentEntries('POST', p.id, p.slug, (s) => `/blog/${s}`, p.updatedAt, 0.6, 'weekly')))
  ).flat()

  // Dynamic Case Studies
  const caseStudies = await prisma.caseStudy.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { id: true, slug: true, updatedAt: true },
  })
  const caseStudyRoutes = (
    await Promise.all(caseStudies.map((c) => contentEntries('CASE_STUDY', c.id, c.slug, (s) => `/case-studies/${s}`, c.updatedAt, 0.7, 'monthly')))
  ).flat()

  // Dynamic Services — only real DB-backed, indexable services; the
  // placeholder fallback services shown before any are added are never
  // real routes meant for indexing, so they're deliberately excluded.
  const services = await prisma.agencyService.findMany({
    where: { isIndexable: true, slug: { not: null } },
    select: { id: true, slug: true, updatedAt: true },
  })
  const serviceRoutes = (
    await Promise.all(services.map((s) => contentEntries('SERVICE', s.id, s.slug!, (slug) => `/services/${slug}`, s.updatedAt, 0.7, 'monthly')))
  ).flat()

  return [...staticRoutes, ...pageRoutes, ...postRoutes, ...caseStudyRoutes, ...serviceRoutes]
}
