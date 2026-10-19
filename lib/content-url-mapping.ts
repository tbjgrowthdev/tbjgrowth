import prisma from "@/lib/prisma";

export type MappableContentType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";
export type ContentMatch = { contentType: MappableContentType; contentId: string };

/**
 * Strips origin/query/trailing slash from a full URL, returning just its
 * path. Search Console's `page` dimension is a full URL; GA4's
 * `landingPage` dimension is already a bare path, so GA4 callers skip this
 * and pass the path straight to resolveContentMap.
 */
export function parseUrlPath(pageUrl: string): string {
  try {
    return new URL(pageUrl).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return pageUrl.split("?")[0].replace(/\/+$/, "") || "/";
  }
}

/**
 * Listing pages (/blog, /services, /case-studies) and the homepage have no
 * single backing content record, so they're deliberately left unmapped
 * rather than guessed at. Anything deeper/unrecognized stays unmapped too.
 */
export function classifyPath(path: string): { contentType: MappableContentType; slug: string } | null {
  if (path === "/" || path === "/blog" || path === "/services" || path === "/case-studies") return null;
  const blog = path.match(/^\/blog\/([^/]+)$/);
  if (blog) return { contentType: "POST", slug: blog[1] };
  const caseStudy = path.match(/^\/case-studies\/([^/]+)$/);
  if (caseStudy) return { contentType: "CASE_STUDY", slug: caseStudy[1] };
  const service = path.match(/^\/services\/([^/]+)$/);
  if (service) return { contentType: "SERVICE", slug: service[1] };
  const page = path.match(/^\/([^/]+)$/);
  if (page) return { contentType: "PAGE", slug: page[1] };
  return null;
}

/**
 * Resolves every distinct content path to a CMS content record in one pass
 * (one query per content table) rather than a query per row — both the GSC
 * and GA4 imports can carry thousands of rows referencing a much smaller
 * set of distinct pages. Slugs are matched regardless of status/
 * indexability: a reporting tool may still report data for a page that's
 * since been unpublished.
 */
export async function resolveContentMap(paths: string[]): Promise<Map<string, ContentMatch | null>> {
  const candidates = new Map<string, { contentType: MappableContentType; slug: string }>();
  for (const path of paths) {
    const classified = classifyPath(path);
    if (classified) candidates.set(path, classified);
  }

  const slugsByType: Record<MappableContentType, Set<string>> = {
    POST: new Set(),
    PAGE: new Set(),
    CASE_STUDY: new Set(),
    SERVICE: new Set(),
  };
  for (const c of candidates.values()) slugsByType[c.contentType].add(c.slug);

  const [posts, pages, caseStudies, services] = await Promise.all([
    slugsByType.POST.size ? prisma.post.findMany({ where: { slug: { in: Array.from(slugsByType.POST) } }, select: { id: true, slug: true } }) : [],
    slugsByType.PAGE.size ? prisma.page.findMany({ where: { slug: { in: Array.from(slugsByType.PAGE) } }, select: { id: true, slug: true } }) : [],
    slugsByType.CASE_STUDY.size
      ? prisma.caseStudy.findMany({ where: { slug: { in: Array.from(slugsByType.CASE_STUDY) } }, select: { id: true, slug: true } })
      : [],
    slugsByType.SERVICE.size
      ? prisma.agencyService.findMany({ where: { slug: { in: Array.from(slugsByType.SERVICE) } }, select: { id: true, slug: true } })
      : [],
  ]);

  const bySlug: Record<MappableContentType, Map<string, string>> = {
    POST: new Map(posts.map((p) => [p.slug, p.id])),
    PAGE: new Map(pages.map((p) => [p.slug, p.id])),
    CASE_STUDY: new Map(caseStudies.map((c) => [c.slug, c.id])),
    SERVICE: new Map(services.filter((s) => s.slug).map((s) => [s.slug as string, s.id])),
  };

  const result = new Map<string, ContentMatch | null>();
  for (const path of paths) {
    const classified = candidates.get(path);
    if (!classified) {
      result.set(path, null);
      continue;
    }
    const id = bySlug[classified.contentType].get(classified.slug);
    result.set(path, id ? { contentType: classified.contentType, contentId: id } : null);
  }
  return result;
}

/** Title/slug lookup for content-mapped summary tables, batched the same way resolveContentMap is. Shared by the GSC and GA4 imports. */
export async function describeContent(items: { contentType: string; contentId: string }[]): Promise<Map<string, { title: string; path: string }>> {
  const ids: Record<MappableContentType, Set<string>> = { POST: new Set(), PAGE: new Set(), CASE_STUDY: new Set(), SERVICE: new Set() };
  for (const item of items) {
    if (item.contentType in ids) ids[item.contentType as MappableContentType].add(item.contentId);
  }

  const [posts, pages, caseStudies, services] = await Promise.all([
    ids.POST.size ? prisma.post.findMany({ where: { id: { in: Array.from(ids.POST) } }, select: { id: true, title: true, slug: true } }) : [],
    ids.PAGE.size ? prisma.page.findMany({ where: { id: { in: Array.from(ids.PAGE) } }, select: { id: true, title: true, slug: true } }) : [],
    ids.CASE_STUDY.size
      ? prisma.caseStudy.findMany({ where: { id: { in: Array.from(ids.CASE_STUDY) } }, select: { id: true, title: true, slug: true } })
      : [],
    ids.SERVICE.size
      ? prisma.agencyService.findMany({ where: { id: { in: Array.from(ids.SERVICE) } }, select: { id: true, title: true, slug: true } })
      : [],
  ]);

  const result = new Map<string, { title: string; path: string }>();
  for (const p of posts) result.set(`POST:${p.id}`, { title: p.title, path: `/blog/${p.slug}` });
  for (const p of pages) result.set(`PAGE:${p.id}`, { title: p.title, path: `/${p.slug}` });
  for (const c of caseStudies) result.set(`CASE_STUDY:${c.id}`, { title: c.title, path: `/case-studies/${c.slug}` });
  for (const s of services) result.set(`SERVICE:${s.id}`, { title: s.title, path: `/services/${s.slug}` });
  return result;
}
