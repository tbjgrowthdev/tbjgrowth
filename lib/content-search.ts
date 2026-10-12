import prisma from "@/lib/prisma";

export type ContentKind = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";

export type SearchResultItem = {
  id: string;
  type: ContentKind;
  title: string;
  slug: string | null;
  authorName: string | null;
  status: string | null;
  categories: string[];
  tags: string[];
  focusKeyword: string | null;
  isIndexable: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  metaTitle: string | null;
  metaDescription: string | null;
  schemaJson: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
  adminUrl: string;
};

export type SearchFilters = {
  query?: string;
  type?: ContentKind;
  author?: string;
  status?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  seoStatus?: "indexable" | "noindex";
  publishedFrom?: string;
  publishedTo?: string;
  modifiedFrom?: string;
  modifiedTo?: string;
  missingMetadata?: boolean;
  missingSchema?: boolean;
  missingAlt?: boolean;
};

// Each content type has a different field set (Page has no categories/tags,
// AgencyService has no status/focusKeyword/schemaJson/featuredImage at
// all) — rather than building four separate Prisma query paths per filter
// combination, every type is normalized into one shape here and filtered
// in JS. A type missing a given field just never matches that filter,
// which is the correct behavior, not a gap — a Page genuinely doesn't have
// a "category" to find. This scales fine at this site's content volume
// (dozens of items, not thousands); revisit with real DB-level filtering
// if that ever changes.
async function getAllItems(): Promise<SearchResultItem[]> {
  const [posts, pages, cases, services] = await Promise.all([
    prisma.post.findMany({ include: { author: true, categories: true, tags: true } }),
    prisma.page.findMany({ include: { author: true } }),
    prisma.caseStudy.findMany({ include: { author: true, categories: true, tags: true } }),
    prisma.agencyService.findMany(),
  ]);

  const items: SearchResultItem[] = [];

  for (const p of posts) {
    items.push({
      id: p.id,
      type: "POST",
      title: p.title,
      slug: p.slug,
      authorName: p.author?.name ?? null,
      status: p.status,
      categories: p.categories.map((c) => c.name),
      tags: p.tags.map((t) => t.name),
      focusKeyword: p.focusKeyword,
      isIndexable: p.isIndexable,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      schemaJson: p.schemaJson,
      featuredImage: p.featuredImage,
      featuredImageAlt: p.featuredImageAlt,
      adminUrl: `/admin/posts/${p.id}`,
    });
  }

  for (const p of pages) {
    items.push({
      id: p.id,
      type: "PAGE",
      title: p.title,
      slug: p.slug,
      authorName: p.author?.name ?? null,
      status: p.status,
      categories: [],
      tags: [],
      focusKeyword: p.focusKeyword,
      isIndexable: p.isIndexable,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      schemaJson: p.schemaJson,
      featuredImage: null,
      featuredImageAlt: null,
      adminUrl: `/admin/pages/${p.id}`,
    });
  }

  for (const c of cases) {
    items.push({
      id: c.id,
      type: "CASE_STUDY",
      title: c.title,
      slug: c.slug,
      authorName: c.author?.name ?? null,
      status: c.status,
      categories: c.categories.map((x) => x.name),
      tags: c.tags.map((x) => x.name),
      focusKeyword: c.focusKeyword,
      isIndexable: c.isIndexable,
      publishedAt: c.publishedAt,
      updatedAt: c.updatedAt,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      schemaJson: c.schemaJson,
      featuredImage: c.featuredImage,
      featuredImageAlt: c.featuredImageAlt,
      adminUrl: `/admin/cases/${c.id}`,
    });
  }

  for (const s of services) {
    items.push({
      id: s.id,
      type: "SERVICE",
      title: s.title,
      slug: s.slug,
      authorName: null,
      status: null,
      categories: [],
      tags: [],
      focusKeyword: null,
      isIndexable: s.isIndexable,
      publishedAt: null,
      updatedAt: s.updatedAt,
      metaTitle: s.metaTitle,
      metaDescription: s.metaDescription,
      schemaJson: null,
      featuredImage: null,
      featuredImageAlt: null,
      adminUrl: `/admin/services/${s.id}`,
    });
  }

  return items;
}

export async function searchContent(filters: SearchFilters): Promise<SearchResultItem[]> {
  let items = await getAllItems();

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q) || i.slug?.toLowerCase().includes(q));
  }
  if (filters.type) items = items.filter((i) => i.type === filters.type);
  if (filters.author?.trim()) {
    const q = filters.author.trim().toLowerCase();
    items = items.filter((i) => i.authorName?.toLowerCase().includes(q));
  }
  if (filters.status) items = items.filter((i) => i.status === filters.status);
  if (filters.category) items = items.filter((i) => i.categories.includes(filters.category!));
  if (filters.tag) items = items.filter((i) => i.tags.includes(filters.tag!));
  if (filters.keyword?.trim()) {
    const q = filters.keyword.trim().toLowerCase();
    items = items.filter((i) => i.focusKeyword?.toLowerCase().includes(q));
  }
  if (filters.seoStatus === "indexable") items = items.filter((i) => i.isIndexable);
  if (filters.seoStatus === "noindex") items = items.filter((i) => !i.isIndexable);
  if (filters.publishedFrom) {
    const from = new Date(filters.publishedFrom);
    items = items.filter((i) => i.publishedAt && i.publishedAt >= from);
  }
  if (filters.publishedTo) {
    const to = new Date(filters.publishedTo);
    items = items.filter((i) => i.publishedAt && i.publishedAt <= to);
  }
  if (filters.modifiedFrom) {
    const from = new Date(filters.modifiedFrom);
    items = items.filter((i) => i.updatedAt >= from);
  }
  if (filters.modifiedTo) {
    const to = new Date(filters.modifiedTo);
    items = items.filter((i) => i.updatedAt <= to);
  }
  if (filters.missingMetadata) items = items.filter((i) => !i.metaTitle?.trim() || !i.metaDescription?.trim());
  if (filters.missingSchema) items = items.filter((i) => !i.schemaJson?.trim());
  if (filters.missingAlt) items = items.filter((i) => Boolean(i.featuredImage) && !i.featuredImageAlt?.trim());

  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getSearchFacets() {
  const [categories, tags, authors] = await Promise.all([
    prisma.category.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.tag.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ select: { name: true }, where: { name: { not: null } }, orderBy: { name: "asc" } }),
  ]);
  return {
    categories: categories.map((c) => c.name),
    tags: tags.map((t) => t.name),
    authors: Array.from(new Set(authors.map((a) => a.name!))),
  };
}
