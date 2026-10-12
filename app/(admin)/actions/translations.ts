"use server";

import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";
import { searchContent, getSearchFacets, type SearchFilters } from "@/lib/content-search";
import {
  saveTranslationDraft as libSaveTranslationDraft,
  publishTranslation as libPublishTranslation,
  unpublishTranslation as libUnpublishTranslation,
  deleteTranslation as libDeleteTranslation,
  getTranslationStatusMap as libGetTranslationStatusMap,
  getTranslation,
  type TranslatableKind,
} from "@/lib/translation";

// Each of these just forwards to lib/translation.ts, which already does its
// own requirePermission/catch — kept here (rather than re-exported directly)
// so this file stays the one Server Action boundary, matching every other
// app/(admin)/actions/*.ts file's convention in this codebase.

export async function saveTranslationDraft(
  contentType: TranslatableKind,
  contentId: string,
  locale: string,
  data: Parameters<typeof libSaveTranslationDraft>[3]
) {
  return libSaveTranslationDraft(contentType, contentId, locale, data);
}

export async function publishTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  return libPublishTranslation(contentType, contentId, locale);
}

export async function unpublishTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  return libUnpublishTranslation(contentType, contentId, locale);
}

export async function deleteTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  return libDeleteTranslation(contentType, contentId, locale);
}

export async function getTranslationStatusMap(contentType: TranslatableKind, contentId: string) {
  return libGetTranslationStatusMap(contentType, contentId);
}

export async function getExistingTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  try {
    await requireSession();
    return await getTranslation(contentType, contentId, locale);
  } catch (error) {
    console.error(`Failed to fetch translation ${contentType}:${contentId}:${locale}:`, error);
    return null;
  }
}

// Picker list for POST/PAGE/CASE_STUDY/SERVICE — reuses the Advanced CMS
// Search normalization (lib/content-search.ts) rather than a second
// "list every content item" query path.
export async function getTranslatableContent(filters: SearchFilters = {}) {
  try {
    await requireSession();
    return await searchContent(filters);
  } catch (error) {
    console.error("Failed to fetch translatable content:", error);
    return [];
  }
}

export async function getTranslatableFacets() {
  try {
    await requireSession();
    return await getSearchFacets();
  } catch (error) {
    console.error("Failed to fetch translatable content facets:", error);
    return { categories: [], tags: [], authors: [] };
  }
}

// Categories/Tags aren't covered by content-search (posts/pages/cases/
// services only) — a small, separate list for the two taxonomy kinds.
export async function getTranslatableTaxonomy() {
  try {
    await requireSession();
    const [categories, tags] = await Promise.all([
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.tag.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { categories, tags };
  } catch (error) {
    console.error("Failed to fetch translatable taxonomy:", error);
    return { categories: [], tags: [] };
  }
}

/**
 * The base record's current (English) field values, for the editor's
 * read-only reference panel — never used to pre-fill the editable
 * translation fields themselves.
 */
export async function getBaseContentForTranslation(contentType: TranslatableKind, contentId: string) {
  try {
    await requireSession();
    switch (contentType) {
      case "POST":
        return await prisma.post.findUnique({ where: { id: contentId } });
      case "PAGE":
        return await prisma.page.findUnique({ where: { id: contentId } });
      case "CASE_STUDY":
        return await prisma.caseStudy.findUnique({ where: { id: contentId } });
      case "SERVICE":
        return await prisma.agencyService.findUnique({ where: { id: contentId } });
      case "CATEGORY":
        return await prisma.category.findUnique({ where: { id: contentId } });
      case "TAG":
        return await prisma.tag.findUnique({ where: { id: contentId } });
      default:
        return null;
    }
  } catch (error) {
    console.error(`Failed to fetch base content ${contentType}:${contentId}:`, error);
    return null;
  }
}
