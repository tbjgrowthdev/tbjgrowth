import prisma from "@/lib/prisma";
import { getTranslationsForContent } from "@/lib/translation";
import { getLocaleByCode } from "@/lib/i18n";

export type ContentKind = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "LOCATION";

export type DependencyCategory = "Internal Links" | "Menus" | "Related Content" | "Schema References" | "Redirects" | "Translations";

export type DependencyFinding = {
  category: DependencyCategory;
  description: string;
};

// The site's nav is hardcoded JSX (Navbar.tsx/Footer.tsx), not DB-driven, so
// there's no table to query — this is the actual current set of hrefs those
// two components link to. Kept in sync by hand; if the nav changes, update
// this list too. In practice this almost never fires for real content
// (dynamic Post/CaseStudy/Service slugs never collide with these), but it
// catches the one case that matters: a generic Page created with a slug
// that happens to match a nav-linked path.
const STATIC_NAV_PATHS = ["/", "/about", "/services", "/case-studies", "/contact", "/blog"];

function getPublicPath(kind: ContentKind, slug: string): string {
  switch (kind) {
    case "POST":
      return `/blog/${slug}`;
    case "PAGE":
      return `/${slug}`;
    case "CASE_STUDY":
      return `/case-studies/${slug}`;
    case "SERVICE":
      return `/services/${slug}`;
    case "LOCATION":
      return `/locations/${slug}`;
  }
}

// Href matches inside another content item's rich-text body. Reported as
// "Internal Links" — this CMS's editor has no distinct CTA block type (a
// CTA is just a styled anchor tag), so a CTA pointing at this content is
// indistinguishable from a plain link at the data level and surfaces here
// too, rather than under a separate category we can't actually detect.
async function findInternalLinks(path: string, excludeKind: ContentKind, excludeId: string): Promise<DependencyFinding[]> {
  const findings: DependencyFinding[] = [];

  const postWhere: Record<string, unknown> = { content: { contains: path } };
  if (excludeKind === "POST") postWhere.id = { not: excludeId };
  const pageWhere: Record<string, unknown> = { content: { contains: path } };
  if (excludeKind === "PAGE") pageWhere.id = { not: excludeId };
  const caseWhere: Record<string, unknown> = { content: { contains: path } };
  if (excludeKind === "CASE_STUDY") caseWhere.id = { not: excludeId };
  const serviceWhere: Record<string, unknown> = { content: { contains: path } };
  if (excludeKind === "SERVICE") serviceWhere.id = { not: excludeId };

  const [posts, pages, cases, services] = await Promise.all([
    prisma.post.findMany({ where: postWhere, select: { title: true, slug: true } }),
    prisma.page.findMany({ where: pageWhere, select: { title: true, slug: true } }),
    prisma.caseStudy.findMany({ where: caseWhere, select: { title: true, slug: true } }),
    prisma.agencyService.findMany({ where: serviceWhere, select: { title: true, slug: true } }),
  ]);

  for (const p of posts) findings.push({ category: "Internal Links", description: `Linked from blog post "${p.title}"` });
  for (const p of pages) findings.push({ category: "Internal Links", description: `Linked from page "${p.title}"` });
  for (const c of cases) findings.push({ category: "Internal Links", description: `Linked from case study "${c.title}"` });
  for (const s of services) findings.push({ category: "Internal Links", description: `Linked from service "${s.title}"` });

  return findings;
}

async function findSchemaReferences(path: string, excludeKind: ContentKind, excludeId: string): Promise<DependencyFinding[]> {
  // AgencyService has no schemaJson field — only Post/Page/CaseStudy build
  // JSON-LD today.
  const findings: DependencyFinding[] = [];

  const postWhere: Record<string, unknown> = { schemaJson: { contains: path } };
  if (excludeKind === "POST") postWhere.id = { not: excludeId };
  const pageWhere: Record<string, unknown> = { schemaJson: { contains: path } };
  if (excludeKind === "PAGE") pageWhere.id = { not: excludeId };
  const caseWhere: Record<string, unknown> = { schemaJson: { contains: path } };
  if (excludeKind === "CASE_STUDY") caseWhere.id = { not: excludeId };

  const [posts, pages, cases] = await Promise.all([
    prisma.post.findMany({ where: postWhere, select: { title: true } }),
    prisma.page.findMany({ where: pageWhere, select: { title: true } }),
    prisma.caseStudy.findMany({ where: caseWhere, select: { title: true } }),
  ]);

  for (const p of posts) findings.push({ category: "Schema References", description: `Referenced in the JSON-LD schema of blog post "${p.title}"` });
  for (const p of pages) findings.push({ category: "Schema References", description: `Referenced in the JSON-LD schema of page "${p.title}"` });
  for (const c of cases) findings.push({ category: "Schema References", description: `Referenced in the JSON-LD schema of case study "${c.title}"` });

  return findings;
}

async function findRedirects(path: string): Promise<DependencyFinding[]> {
  const redirects = await prisma.redirect.findMany({ where: { destination: { contains: path } } });
  return redirects.map((r) => ({
    category: "Redirects" as const,
    description: `Redirect "${r.source}" → "${r.destination}" would point to a page that no longer exists`,
  }));
}

function findMenuReferences(path: string): DependencyFinding[] {
  if (!STATIC_NAV_PATHS.includes(path)) return [];
  return [{ category: "Menus", description: `This URL (${path}) is hardcoded into the site's header or footer navigation` }];
}

async function findRelatedContent(kind: ContentKind, id: string): Promise<DependencyFinding[]> {
  const findings: DependencyFinding[] = [];

  if (kind === "CASE_STUDY") {
    const cs = await prisma.caseStudy.findUnique({ where: { id }, select: { isFeatured: true } });
    if (cs?.isFeatured) {
      findings.push({ category: "Related Content", description: "Marked Featured — currently shown in the Case Studies section on the home page" });
    }
  }

  if (kind === "POST") {
    const post = await prisma.post.findUnique({ where: { id }, include: { categories: true, tags: true } });
    if (post && (post.categories.length > 0 || post.tags.length > 0)) {
      const categoryIds = post.categories.map((c) => c.id);
      const tagIds = post.tags.map((t) => t.id);
      const relatedCount = await prisma.post.count({
        where: {
          id: { not: id },
          status: "PUBLISHED",
          OR: [
            ...(categoryIds.length ? [{ categories: { some: { id: { in: categoryIds } } } }] : []),
            ...(tagIds.length ? [{ tags: { some: { id: { in: tagIds } } } }] : []),
          ],
        },
      });
      if (relatedCount > 0) {
        findings.push({
          category: "Related Content",
          description: `Shares a category or tag with ${relatedCount} other published post${relatedCount > 1 ? "s" : ""} — may currently surface there as a "related post"`,
        });
      }
    }
  }

  return findings;
}

// Deleting the base record leaves ContentTranslation rows as harmless
// orphans (same as ContentVersion/ApprovalHistory already do for every
// content type — see lib/translation.ts's schema comment) rather than
// cascading, so this is purely a warning, not a blocker.
async function findTranslationDependencies(kind: ContentKind, id: string): Promise<DependencyFinding[]> {
  // Locations aren't a translatable content type (see lib/translation.ts's
  // TranslatableKind) — no ContentTranslation rows can exist for one.
  if (kind === "LOCATION") return [];
  const translations = await getTranslationsForContent(kind, id);
  return translations.map((t) => {
    const locale = getLocaleByCode(t.locale);
    const label = t.status === "PUBLISHED" ? "published" : "draft";
    return {
      category: "Translations" as const,
      description: `Has a ${label} ${locale?.label ?? t.locale} translation that will become orphaned`,
    };
  });
}

export async function findDependencies(kind: ContentKind, id: string): Promise<DependencyFinding[]> {
  let slug: string | null | undefined;
  switch (kind) {
    case "POST": {
      const r = await prisma.post.findUnique({ where: { id }, select: { slug: true } });
      slug = r?.slug;
      break;
    }
    case "PAGE": {
      const r = await prisma.page.findUnique({ where: { id }, select: { slug: true } });
      slug = r?.slug;
      break;
    }
    case "CASE_STUDY": {
      const r = await prisma.caseStudy.findUnique({ where: { id }, select: { slug: true } });
      slug = r?.slug;
      break;
    }
    case "SERVICE": {
      const r = await prisma.agencyService.findUnique({ where: { id }, select: { slug: true } });
      slug = r?.slug;
      break;
    }
    case "LOCATION": {
      const r = await prisma.location.findUnique({ where: { id }, select: { slug: true } });
      slug = r?.slug;
      break;
    }
  }

  // No slug — e.g. an AgencyService never given one — means no public path,
  // so there's nothing a link/redirect/schema reference could point at.
  // A translation keyed on contentId doesn't need one either way.
  if (!slug) {
    const [related, translations] = await Promise.all([findRelatedContent(kind, id), findTranslationDependencies(kind, id)]);
    return [...related, ...translations];
  }

  const path = getPublicPath(kind, slug);

  const [links, schema, redirects, related, translations] = await Promise.all([
    findInternalLinks(path, kind, id),
    findSchemaReferences(path, kind, id),
    findRedirects(path),
    findRelatedContent(kind, id),
    findTranslationDependencies(kind, id),
  ]);

  return [...links, ...findMenuReferences(path), ...schema, ...redirects, ...related, ...translations];
}
