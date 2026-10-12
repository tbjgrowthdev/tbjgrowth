import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { recordVersion } from "@/lib/versioning";
import { isLockedByOther } from "@/lib/content-lock";
import { rowsToCsv, csvToObjects } from "@/lib/csv";

// Shared across every importer below. Row-level failures never abort the
// batch — one bad row is reported in `errors` and the rest still import,
// same philosophy as the existing bulkImportRedirects().
export type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };

type Actor = { id: string; name: string | null; email: string | null };

function emptyResult(): ImportResult {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

// Category/Tag names are resolved (not required to pre-exist) so a Post/
// CaseStudy export from one environment imports cleanly into another that
// doesn't have the same taxonomy yet — this mirrors upsert-by-name, the
// same matching strategy used for the dedicated Category/Tag import below.
async function resolveCategoryIds(names: unknown): Promise<string[]> {
  if (!Array.isArray(names)) return [];
  const ids: string[] = [];
  for (const raw of names) {
    const name = String(raw).trim();
    const slug = slugify(name);
    if (!name || !slug) continue;
    const category = await prisma.category.upsert({ where: { name }, create: { name, slug }, update: {} });
    ids.push(category.id);
  }
  return ids;
}

async function resolveTagIds(names: unknown): Promise<string[]> {
  if (!Array.isArray(names)) return [];
  const ids: string[] = [];
  for (const raw of names) {
    const name = String(raw).trim();
    const slug = slugify(name);
    if (!name || !slug) continue;
    const tag = await prisma.tag.upsert({ where: { name }, create: { name, slug }, update: {} });
    ids.push(tag.id);
  }
  return ids;
}

function parseJsonArray(text: string, label: string): { rows: any[]; error?: string } {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return { rows: [], error: `Expected a JSON array of ${label}` };
    return { rows: parsed };
  } catch (e: any) {
    return { rows: [], error: `Invalid JSON: ${e.message}` };
  }
}

// ------------------------------------------------------------------
// Pages — JSON (nested-free, but content is long-form HTML; a flat CSV
// cell would work but JSON keeps this consistent with Post/CaseStudy/
// Service, the three richer content types it's exported alongside).
// ------------------------------------------------------------------

export async function exportPagesJson(): Promise<string> {
  const pages = await prisma.page.findMany({ include: { author: true }, orderBy: { createdAt: "asc" } });
  return JSON.stringify(
    pages.map((p) => ({
      title: p.title,
      slug: p.slug,
      content: p.content,
      status: p.status,
      isIndexable: p.isIndexable,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      focusKeyword: p.focusKeyword,
      canonicalUrl: p.canonicalUrl,
      twitterCard: p.twitterCard,
      ogImage: p.ogImage,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
      twitterTitle: p.twitterTitle,
      twitterDescription: p.twitterDescription,
      twitterImage: p.twitterImage,
      schemaJson: p.schemaJson,
      authorEmail: p.author?.email ?? null,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    null,
    2
  );
}

// Import only ever touches content + SEO fields. status/publishedAt/author/
// reviewer-approver assignments are workflow state, never set here — an
// imported page always lands as a DRAFT on create and keeps its existing
// lifecycle stage untouched on update, exactly like every other bulk/
// programmatic write path in this app (see createPost's "status is never
// trusted from the caller" comment, same rule applies here).
export async function importPagesJson(jsonText: string, actor: Actor): Promise<ImportResult> {
  const result = emptyResult();
  const { rows, error } = parseJsonArray(jsonText, "pages");
  if (error) {
    result.errors.push(error);
    return result;
  }

  for (const row of rows) {
    const slug = slugify(row.slug || row.title || "");
    if (!slug || !row.title) {
      result.skipped++;
      result.errors.push("Row missing title/slug — skipped");
      continue;
    }

    try {
      const existing = await prisma.page.findUnique({ where: { slug } });
      const data = {
        title: row.title,
        content: row.content ?? null,
        metaTitle: row.metaTitle ?? null,
        metaDescription: row.metaDescription ?? null,
        focusKeyword: row.focusKeyword ?? null,
        canonicalUrl: row.canonicalUrl ?? null,
        twitterCard: row.twitterCard ?? null,
        ogImage: row.ogImage ?? null,
        ogTitle: row.ogTitle ?? null,
        ogDescription: row.ogDescription ?? null,
        twitterTitle: row.twitterTitle ?? null,
        twitterDescription: row.twitterDescription ?? null,
        twitterImage: row.twitterImage ?? null,
        schemaJson: row.schemaJson ?? null,
        isIndexable: row.isIndexable ?? true,
      };

      if (existing) {
        const lock = await isLockedByOther("PAGE", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.page.update({ where: { id: existing.id }, data });
        await recordVersion("PAGE", updated.id, updated, actor, "Imported (update)");
        result.updated++;
      } else {
        const created = await prisma.page.create({ data: { ...data, slug, status: "DRAFT" } });
        await recordVersion("PAGE", created.id, created, actor, "Imported");
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${slug}: ${error.message}`);
    }
  }

  revalidatePath("/admin/pages");
  return result;
}

// ------------------------------------------------------------------
// Posts — JSON (categories/tags are exported as name arrays, not ids, so
// the file is portable across environments with different taxonomy ids).
// ------------------------------------------------------------------

export async function exportPostsJson(): Promise<string> {
  const posts = await prisma.post.findMany({ include: { author: true, categories: true, tags: true }, orderBy: { createdAt: "asc" } });
  return JSON.stringify(
    posts.map((p) => ({
      title: p.title,
      slug: p.slug,
      content: p.content,
      excerpt: p.excerpt,
      featuredImage: p.featuredImage,
      featuredImageAlt: p.featuredImageAlt,
      categories: p.categories.map((c) => c.name),
      tags: p.tags.map((t) => t.name),
      status: p.status,
      isIndexable: p.isIndexable,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      focusKeyword: p.focusKeyword,
      canonicalUrl: p.canonicalUrl,
      twitterCard: p.twitterCard,
      ogImage: p.ogImage,
      ogTitle: p.ogTitle,
      ogDescription: p.ogDescription,
      twitterTitle: p.twitterTitle,
      twitterDescription: p.twitterDescription,
      twitterImage: p.twitterImage,
      schemaJson: p.schemaJson,
      authorEmail: p.author?.email ?? null,
      publishedAt: p.publishedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    null,
    2
  );
}

export async function importPostsJson(jsonText: string, actor: Actor): Promise<ImportResult> {
  const result = emptyResult();
  const { rows, error } = parseJsonArray(jsonText, "posts");
  if (error) {
    result.errors.push(error);
    return result;
  }

  for (const row of rows) {
    const slug = slugify(row.slug || row.title || "");
    if (!slug || !row.title || !row.content) {
      result.skipped++;
      result.errors.push("Row missing title/content/slug — skipped");
      continue;
    }

    try {
      const categoryIds = await resolveCategoryIds(row.categories);
      const tagIds = await resolveTagIds(row.tags);
      const existing = await prisma.post.findUnique({ where: { slug } });
      const scalarData = {
        title: row.title,
        content: row.content,
        excerpt: row.excerpt ?? null,
        featuredImage: row.featuredImage ?? null,
        featuredImageAlt: row.featuredImageAlt ?? null,
        metaTitle: row.metaTitle ?? null,
        metaDescription: row.metaDescription ?? null,
        focusKeyword: row.focusKeyword ?? null,
        canonicalUrl: row.canonicalUrl ?? null,
        twitterCard: row.twitterCard ?? null,
        ogImage: row.ogImage ?? null,
        ogTitle: row.ogTitle ?? null,
        ogDescription: row.ogDescription ?? null,
        twitterTitle: row.twitterTitle ?? null,
        twitterDescription: row.twitterDescription ?? null,
        twitterImage: row.twitterImage ?? null,
        schemaJson: row.schemaJson ?? null,
        isIndexable: row.isIndexable ?? true,
      };

      if (existing) {
        const lock = await isLockedByOther("POST", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.post.update({
          where: { id: existing.id },
          data: { ...scalarData, categories: { set: categoryIds.map((id) => ({ id })) }, tags: { set: tagIds.map((id) => ({ id })) } },
          include: { categories: true, tags: true },
        });
        await recordVersion("POST", updated.id, updated, actor, "Imported (update)");
        result.updated++;
      } else {
        const created = await prisma.post.create({
          data: {
            ...scalarData,
            slug,
            status: "DRAFT",
            authorId: actor.id,
            categories: { connect: categoryIds.map((id) => ({ id })) },
            tags: { connect: tagIds.map((id) => ({ id })) },
          },
          include: { categories: true, tags: true },
        });
        await recordVersion("POST", created.id, created, actor, "Imported");
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${slug}: ${error.message}`);
    }
  }

  revalidatePath("/admin/posts");
  revalidatePath("/blog");
  return result;
}

// ------------------------------------------------------------------
// Case Studies — JSON, same shape/rules as Posts.
// ------------------------------------------------------------------

export async function exportCaseStudiesJson(): Promise<string> {
  const cases = await prisma.caseStudy.findMany({ include: { author: true, categories: true, tags: true }, orderBy: { createdAt: "asc" } });
  return JSON.stringify(
    cases.map((c) => ({
      title: c.title,
      slug: c.slug,
      clientName: c.clientName,
      industry: c.industry,
      serviceType: c.serviceType,
      results: c.results,
      content: c.content,
      excerpt: c.excerpt,
      websiteUrl: c.websiteUrl,
      featuredImage: c.featuredImage,
      featuredImageAlt: c.featuredImageAlt,
      imageGallery: c.imageGallery,
      isFeatured: c.isFeatured,
      categories: c.categories.map((x) => x.name),
      tags: c.tags.map((x) => x.name),
      status: c.status,
      isIndexable: c.isIndexable,
      metaTitle: c.metaTitle,
      metaDescription: c.metaDescription,
      focusKeyword: c.focusKeyword,
      canonicalUrl: c.canonicalUrl,
      twitterCard: c.twitterCard,
      ogImage: c.ogImage,
      ogTitle: c.ogTitle,
      ogDescription: c.ogDescription,
      twitterTitle: c.twitterTitle,
      twitterDescription: c.twitterDescription,
      twitterImage: c.twitterImage,
      schemaJson: c.schemaJson,
      authorEmail: c.author?.email ?? null,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    null,
    2
  );
}

export async function importCaseStudiesJson(jsonText: string, actor: Actor): Promise<ImportResult> {
  const result = emptyResult();
  const { rows, error } = parseJsonArray(jsonText, "case studies");
  if (error) {
    result.errors.push(error);
    return result;
  }

  for (const row of rows) {
    const slug = slugify(row.slug || row.title || "");
    if (!slug || !row.title || !row.content || !row.clientName || !row.industry || !row.serviceType) {
      result.skipped++;
      result.errors.push("Row missing a required field (title/content/clientName/industry/serviceType/slug) — skipped");
      continue;
    }

    try {
      const categoryIds = await resolveCategoryIds(row.categories);
      const tagIds = await resolveTagIds(row.tags);
      const existing = await prisma.caseStudy.findUnique({ where: { slug } });
      const scalarData = {
        title: row.title,
        clientName: row.clientName,
        industry: row.industry,
        serviceType: row.serviceType,
        results: row.results ?? null,
        content: row.content,
        excerpt: row.excerpt ?? null,
        websiteUrl: row.websiteUrl ?? null,
        featuredImage: row.featuredImage ?? null,
        featuredImageAlt: row.featuredImageAlt ?? null,
        imageGallery: Array.isArray(row.imageGallery) ? row.imageGallery : [],
        isFeatured: row.isFeatured ?? false,
        metaTitle: row.metaTitle ?? null,
        metaDescription: row.metaDescription ?? null,
        focusKeyword: row.focusKeyword ?? null,
        canonicalUrl: row.canonicalUrl ?? null,
        twitterCard: row.twitterCard ?? null,
        ogImage: row.ogImage ?? null,
        ogTitle: row.ogTitle ?? null,
        ogDescription: row.ogDescription ?? null,
        twitterTitle: row.twitterTitle ?? null,
        twitterDescription: row.twitterDescription ?? null,
        twitterImage: row.twitterImage ?? null,
        schemaJson: row.schemaJson ?? null,
        isIndexable: row.isIndexable ?? true,
      };

      if (existing) {
        const lock = await isLockedByOther("CASE_STUDY", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.caseStudy.update({
          where: { id: existing.id },
          data: { ...scalarData, categories: { set: categoryIds.map((id) => ({ id })) }, tags: { set: tagIds.map((id) => ({ id })) } },
          include: { categories: true, tags: true },
        });
        await recordVersion("CASE_STUDY", updated.id, updated, actor, "Imported (update)");
        result.updated++;
      } else {
        const created = await prisma.caseStudy.create({
          data: {
            ...scalarData,
            slug,
            status: "DRAFT",
            authorId: actor.id,
            categories: { connect: categoryIds.map((id) => ({ id })) },
            tags: { connect: tagIds.map((id) => ({ id })) },
          },
          include: { categories: true, tags: true },
        });
        await recordVersion("CASE_STUDY", created.id, created, actor, "Imported");
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${slug}: ${error.message}`);
    }
  }

  revalidatePath("/admin/cases");
  revalidatePath("/case-studies");
  return result;
}

// ------------------------------------------------------------------
// Services — JSON. features/process/deliverables are stored as JSON-
// encoded text in the DB already; exported/imported as opaque strings
// rather than re-parsed, so round-tripping can never corrupt a shape this
// code doesn't otherwise need to understand (including the legacy
// {icon,text} object form the schema comment calls out).
// ------------------------------------------------------------------

export async function exportServicesJson(): Promise<string> {
  const services = await prisma.agencyService.findMany({ include: { faqs: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } });
  return JSON.stringify(
    services.map((s) => ({
      title: s.title,
      slug: s.slug,
      subtitle: s.subtitle,
      description: s.description,
      detailTitle: s.detailTitle,
      detailIntro: s.detailIntro,
      content: s.content,
      iconName: s.iconName,
      features: s.features,
      process: s.process,
      deliverables: s.deliverables,
      statValue: s.statValue,
      statLabel: s.statLabel,
      gradient: s.gradient,
      order: s.order,
      metaTitle: s.metaTitle,
      metaDescription: s.metaDescription,
      ogImage: s.ogImage,
      twitterCard: s.twitterCard,
      isIndexable: s.isIndexable,
      ogTitle: s.ogTitle,
      ogDescription: s.ogDescription,
      twitterTitle: s.twitterTitle,
      twitterDescription: s.twitterDescription,
      twitterImage: s.twitterImage,
      faqs: s.faqs.map((f) => ({ question: f.question, answer: f.answer })),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    null,
    2
  );
}

// Services have no workflow/status to protect, but still go through the
// same lock-check as every other importer — a Service row can be open in
// ServiceForm with ContentLock acquired under contentType "SERVICE".
export async function importServicesJson(jsonText: string, actor: Actor): Promise<ImportResult> {
  const result = emptyResult();
  const { rows, error } = parseJsonArray(jsonText, "services");
  if (error) {
    result.errors.push(error);
    return result;
  }

  for (const row of rows) {
    const slug = slugify(row.slug || row.title || "");
    if (!slug || !row.title || !row.description || !row.iconName) {
      result.skipped++;
      result.errors.push("Row missing a required field (title/description/iconName/slug) — skipped");
      continue;
    }

    try {
      const existing = await prisma.agencyService.findUnique({ where: { slug } });
      const faqs = Array.isArray(row.faqs) ? row.faqs : [];
      const scalarData = {
        title: row.title,
        subtitle: row.subtitle ?? null,
        description: row.description,
        detailTitle: row.detailTitle ?? null,
        detailIntro: row.detailIntro ?? null,
        content: row.content ?? null,
        iconName: row.iconName,
        features: row.features ?? null,
        process: row.process ?? null,
        deliverables: row.deliverables ?? null,
        statValue: row.statValue ?? null,
        statLabel: row.statLabel ?? null,
        gradient: row.gradient ?? null,
        order: typeof row.order === "number" ? row.order : 0,
        metaTitle: row.metaTitle ?? null,
        metaDescription: row.metaDescription ?? null,
        ogImage: row.ogImage ?? null,
        twitterCard: row.twitterCard ?? null,
        isIndexable: row.isIndexable ?? true,
        ogTitle: row.ogTitle ?? null,
        ogDescription: row.ogDescription ?? null,
        twitterTitle: row.twitterTitle ?? null,
        twitterDescription: row.twitterDescription ?? null,
        twitterImage: row.twitterImage ?? null,
      };

      if (existing) {
        const lock = await isLockedByOther("SERVICE", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        await prisma.agencyService.update({
          where: { id: existing.id },
          data: {
            ...scalarData,
            faqs: { deleteMany: {}, create: faqs.map((f: any, i: number) => ({ question: f.question, answer: f.answer, order: i })) },
          },
        });
        result.updated++;
      } else {
        await prisma.agencyService.create({
          data: {
            ...scalarData,
            slug,
            faqs: { create: faqs.map((f: any, i: number) => ({ question: f.question, answer: f.answer, order: i })) },
          },
        });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${slug}: ${error.message}`);
    }
  }

  revalidatePath("/admin/services");
  revalidatePath("/services");
  revalidatePath("/services/[slug]", "page");
  return result;
}

// ------------------------------------------------------------------
// Categories / Tags — CSV (flat, two-three columns, no nesting).
// Matched by name (unique): existing rows get their description updated
// (Category only); missing rows are created with a derived slug.
// ------------------------------------------------------------------

export async function exportCategoriesCsv(): Promise<string> {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return rowsToCsv(
    ["name", "slug", "description"],
    categories.map((c) => ({ name: c.name, slug: c.slug, description: c.description ?? "" }))
  );
}

export async function importCategoriesCsv(csvText: string): Promise<ImportResult> {
  const result = emptyResult();
  for (const row of csvToObjects(csvText)) {
    const name = row.name?.trim();
    if (!name) {
      result.skipped++;
      continue;
    }
    const slug = slugify(row.slug || name);
    if (!slug) {
      result.skipped++;
      result.errors.push(`"${name}": could not derive a slug — skipped`);
      continue;
    }
    try {
      const existing = await prisma.category.findUnique({ where: { name } });
      if (existing) {
        await prisma.category.update({ where: { id: existing.id }, data: { description: row.description?.trim() || existing.description } });
        result.updated++;
      } else {
        await prisma.category.create({ data: { name, slug, description: row.description?.trim() || null } });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${name}: ${error.message}`);
    }
  }
  revalidatePath("/admin/categories");
  return result;
}

export async function exportTagsCsv(): Promise<string> {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return rowsToCsv(["name", "slug"], tags.map((t) => ({ name: t.name, slug: t.slug })));
}

export async function importTagsCsv(csvText: string): Promise<ImportResult> {
  const result = emptyResult();
  for (const row of csvToObjects(csvText)) {
    const name = row.name?.trim();
    if (!name) {
      result.skipped++;
      continue;
    }
    const slug = slugify(row.slug || name);
    if (!slug) {
      result.skipped++;
      result.errors.push(`"${name}": could not derive a slug — skipped`);
      continue;
    }
    try {
      const existing = await prisma.tag.findUnique({ where: { name } });
      if (existing) {
        result.updated++; // nothing else to update — name is the match key and slug follows it
      } else {
        await prisma.tag.create({ data: { name, slug } });
        result.created++;
      }
    } catch (error: any) {
      result.errors.push(`${name}: ${error.message}`);
    }
  }
  revalidatePath("/admin/tags");
  return result;
}

// ------------------------------------------------------------------
// Redirects — CSV export. Import reuses the existing bulkImportRedirects()
// in app/(admin)/actions/redirects.ts rather than duplicating it here.
// ------------------------------------------------------------------

export async function exportRedirectsCsv(): Promise<string> {
  const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: "asc" } });
  return rowsToCsv(
    ["source", "destination", "statusCode", "createdAt", "updatedAt"],
    redirects.map((r) => ({
      source: r.source,
      destination: r.destination ?? "",
      statusCode: r.statusCode,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
}

// ------------------------------------------------------------------
// Media metadata — CSV. Update-only by design: there is no file in a CSV
// row, so import can never create a MediaAsset (that only happens through
// a real Cloudinary upload) — it just bulk-edits title/altText/folder on
// assets that already exist, matched by publicId first, then url.
// ------------------------------------------------------------------

export async function exportMediaCsv(): Promise<string> {
  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "asc" } });
  return rowsToCsv(
    ["id", "publicId", "url", "filename", "format", "width", "height", "bytes", "folder", "altText", "title", "uploadedByEmail", "createdAt", "updatedAt"],
    assets.map((a) => ({
      id: a.id,
      publicId: a.publicId,
      url: a.url,
      filename: a.filename,
      format: a.format,
      width: a.width,
      height: a.height,
      bytes: a.bytes,
      folder: a.folder,
      altText: a.altText,
      title: a.title,
      uploadedByEmail: a.uploadedByEmail ?? "",
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }))
  );
}

export async function importMediaCsv(csvText: string): Promise<ImportResult> {
  const result = emptyResult();
  for (const row of csvToObjects(csvText)) {
    const publicId = row.publicId?.trim();
    const url = row.url?.trim();
    const label = publicId || url || "(unidentified row)";
    if (!publicId && !url) {
      result.skipped++;
      continue;
    }
    const altText = row.altText?.trim();
    if (!altText) {
      result.skipped++;
      result.errors.push(`${label}: altText is required — row skipped (import never clears required alt text)`);
      continue;
    }
    try {
      const existing = publicId
        ? await prisma.mediaAsset.findUnique({ where: { publicId } })
        : await prisma.mediaAsset.findFirst({ where: { url } });
      if (!existing) {
        result.skipped++;
        result.errors.push(`${label}: no matching asset — media import only updates existing assets, it never uploads new files`);
        continue;
      }
      await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: { altText, title: row.title?.trim() || existing.title, folder: row.folder?.trim() || existing.folder },
      });
      result.updated++;
    } catch (error: any) {
      result.errors.push(`${label}: ${error.message}`);
    }
  }
  revalidatePath("/admin/media");
  return result;
}

// ------------------------------------------------------------------
// SEO metadata — CSV, one row per Post/Page/CaseStudy/Service. Export is
// a cross-content-type flattening (same normalization idea as
// lib/content-search.ts's getAllItems, purpose-built here for the SEO
// field set it doesn't carry). Import updates ONLY the SEO fields listed —
// title is included for human readability but is never written back, and
// content/status/workflow fields are never touched.
// ------------------------------------------------------------------

const SEO_CSV_COLUMNS = [
  "contentType", "slug", "title", "metaTitle", "metaDescription", "focusKeyword",
  "canonicalUrl", "twitterCard", "ogImage", "ogTitle", "ogDescription",
  "twitterTitle", "twitterDescription", "twitterImage", "schemaJson", "isIndexable",
];

export async function exportSeoCsv(): Promise<string> {
  const [posts, pages, cases, services] = await Promise.all([
    prisma.post.findMany(),
    prisma.page.findMany(),
    prisma.caseStudy.findMany(),
    prisma.agencyService.findMany(),
  ]);

  const rows: Record<string, unknown>[] = [];
  const pushRow = (contentType: string, slug: string | null, title: string, f: Record<string, unknown>) => {
    rows.push({
      contentType,
      slug: slug ?? "",
      title,
      metaTitle: f.metaTitle ?? "",
      metaDescription: f.metaDescription ?? "",
      focusKeyword: f.focusKeyword ?? "",
      canonicalUrl: f.canonicalUrl ?? "",
      twitterCard: f.twitterCard ?? "",
      ogImage: f.ogImage ?? "",
      ogTitle: f.ogTitle ?? "",
      ogDescription: f.ogDescription ?? "",
      twitterTitle: f.twitterTitle ?? "",
      twitterDescription: f.twitterDescription ?? "",
      twitterImage: f.twitterImage ?? "",
      schemaJson: f.schemaJson ?? "",
      isIndexable: f.isIndexable,
    });
  };

  posts.forEach((p) => pushRow("POST", p.slug, p.title, p));
  pages.forEach((p) => pushRow("PAGE", p.slug, p.title, p));
  cases.forEach((c) => pushRow("CASE_STUDY", c.slug, c.title, c));
  // AgencyService has no focusKeyword/canonicalUrl/schemaJson column at all.
  services.forEach((s) => pushRow("SERVICE", s.slug, s.title, { ...s, focusKeyword: null, canonicalUrl: null, schemaJson: null }));

  return rowsToCsv(SEO_CSV_COLUMNS, rows);
}

export async function importSeoCsv(csvText: string, actor: Actor): Promise<ImportResult> {
  const result = emptyResult();

  for (const row of csvToObjects(csvText)) {
    const contentType = row.contentType?.trim().toUpperCase();
    const slug = row.slug?.trim();
    if (!contentType || !slug) {
      result.skipped++;
      continue;
    }

    const seoFields: Record<string, unknown> = {
      metaTitle: row.metaTitle?.trim() || null,
      metaDescription: row.metaDescription?.trim() || null,
      ogImage: row.ogImage?.trim() || null,
      twitterCard: row.twitterCard?.trim() || null,
      ogTitle: row.ogTitle?.trim() || null,
      ogDescription: row.ogDescription?.trim() || null,
      twitterTitle: row.twitterTitle?.trim() || null,
      twitterDescription: row.twitterDescription?.trim() || null,
      twitterImage: row.twitterImage?.trim() || null,
      isIndexable: row.isIndexable?.trim().toLowerCase() !== "false",
    };
    if (contentType !== "SERVICE") {
      seoFields.focusKeyword = row.focusKeyword?.trim() || null;
      seoFields.canonicalUrl = row.canonicalUrl?.trim() || null;
      seoFields.schemaJson = row.schemaJson?.trim() || null;
    }

    try {
      if (contentType === "POST") {
        const existing = await prisma.post.findUnique({ where: { slug } });
        if (!existing) {
          result.skipped++;
          result.errors.push(`POST ${slug}: no matching record — skipped`);
          continue;
        }
        const lock = await isLockedByOther("POST", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.post.update({ where: { id: existing.id }, data: seoFields, include: { categories: true, tags: true } });
        await recordVersion("POST", updated.id, updated, actor, "Imported SEO metadata");
      } else if (contentType === "PAGE") {
        const existing = await prisma.page.findUnique({ where: { slug } });
        if (!existing) {
          result.skipped++;
          result.errors.push(`PAGE ${slug}: no matching record — skipped`);
          continue;
        }
        const lock = await isLockedByOther("PAGE", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.page.update({ where: { id: existing.id }, data: seoFields });
        await recordVersion("PAGE", updated.id, updated, actor, "Imported SEO metadata");
      } else if (contentType === "CASE_STUDY") {
        const existing = await prisma.caseStudy.findUnique({ where: { slug } });
        if (!existing) {
          result.skipped++;
          result.errors.push(`CASE_STUDY ${slug}: no matching record — skipped`);
          continue;
        }
        const lock = await isLockedByOther("CASE_STUDY", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        const updated = await prisma.caseStudy.update({ where: { id: existing.id }, data: seoFields, include: { categories: true, tags: true } });
        await recordVersion("CASE_STUDY", updated.id, updated, actor, "Imported SEO metadata");
      } else if (contentType === "SERVICE") {
        const existing = await prisma.agencyService.findUnique({ where: { slug } });
        if (!existing) {
          result.skipped++;
          result.errors.push(`SERVICE ${slug}: no matching record — skipped`);
          continue;
        }
        const lock = await isLockedByOther("SERVICE", existing.id, actor.id);
        if (lock.locked) {
          result.skipped++;
          result.errors.push(`${slug}: being edited by ${lock.lockedByName || "another user"} — skipped`);
          continue;
        }
        await prisma.agencyService.update({ where: { id: existing.id }, data: seoFields });
      } else {
        result.skipped++;
        result.errors.push(`${slug}: unknown contentType "${row.contentType}"`);
        continue;
      }
      result.updated++;
    } catch (error: any) {
      result.errors.push(`${slug}: ${error.message}`);
    }
  }

  revalidatePath("/admin/posts");
  revalidatePath("/admin/pages");
  revalidatePath("/admin/cases");
  revalidatePath("/admin/services");
  return result;
}
