import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tbjgrowth.com'

  // Static routes
  const staticRoutes = [
    '',
    '/about',
    '/services',
    '/contact',
    '/blog',
    '/case-studies',
    '/pricing',
    '/book-a-call',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Dynamic Pages
  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { slug: true, updatedAt: true }
  });

  const pageRoutes = pages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: page.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Dynamic Blog Posts
  const posts = await prisma.post.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { slug: true, updatedAt: true }
  });

  const postRoutes = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  // Dynamic Case Studies
  const caseStudies = await prisma.caseStudy.findMany({
    where: { status: 'PUBLISHED', isIndexable: true },
    select: { slug: true, updatedAt: true }
  });

  const caseStudyRoutes = caseStudies.map((study) => ({
    url: `${baseUrl}/case-studies/${study.slug}`,
    lastModified: study.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Dynamic Services — only real DB-backed, indexable services; the
  // placeholder fallback services shown before any are added are never
  // real routes meant for indexing, so they're deliberately excluded.
  const services = await prisma.agencyService.findMany({
    where: { isIndexable: true, slug: { not: null } },
    select: { slug: true, updatedAt: true },
  });

  const serviceRoutes = services.map((service) => ({
    url: `${baseUrl}/services/${service.slug}`,
    lastModified: service.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...pageRoutes, ...postRoutes, ...caseStudyRoutes, ...serviceRoutes]
}
