import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { checkStale } from "@/lib/stale-check";
import { DEFAULT_LOCALE, PREFIXED_LOCALES, getLocaleByCode } from "@/lib/i18n";

export type TranslatableKind = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "CATEGORY" | "TAG";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

// Maps each ContentTranslation column to the base record's field of the
// same meaning — not always the same name. Service's card blurb is
// `description`, not `excerpt`; Category/Tag's name field is `name`, not
// `title`. A column left out of a type's map (e.g. Page has no subtitle)
// is simply never read for that type, so it's a harmless no-op rather than
// a dead/misleading overlay. Exported so the admin editor can render the
// right fields, with the right labels, per content type.
export const TRANSLATION_FIELD_MAP: Record<TranslatableKind, Record<string, string>> = {
  POST: {
    title: "title", slug: "slug", excerpt: "excerpt", content: "content",
    metaTitle: "metaTitle", metaDescription: "metaDescription", focusKeyword: "focusKeyword",
    ogTitle: "ogTitle", ogDescription: "ogDescription", twitterTitle: "twitterTitle", twitterDescription: "twitterDescription",
  },
  PAGE: {
    title: "title", slug: "slug", content: "content",
    metaTitle: "metaTitle", metaDescription: "metaDescription", focusKeyword: "focusKeyword",
    ogTitle: "ogTitle", ogDescription: "ogDescription", twitterTitle: "twitterTitle", twitterDescription: "twitterDescription",
  },
  CASE_STUDY: {
    title: "title", slug: "slug", excerpt: "excerpt", content: "content",
    metaTitle: "metaTitle", metaDescription: "metaDescription", focusKeyword: "focusKeyword",
    ogTitle: "ogTitle", ogDescription: "ogDescription", twitterTitle: "twitterTitle", twitterDescription: "twitterDescription",
  },
  SERVICE: {
    title: "title", slug: "slug", subtitle: "subtitle", excerpt: "description",
    detailTitle: "detailTitle", detailIntro: "detailIntro", content: "content",
    metaTitle: "metaTitle", metaDescription: "metaDescription",
    ogTitle: "ogTitle", ogDescription: "ogDescription", twitterTitle: "twitterTitle", twitterDescription: "twitterDescription",
  },
  CATEGORY: { title: "name", slug: "slug" },
  TAG: { title: "name", slug: "slug" },
};

export async function getTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  return prisma.contentTranslation.findUnique({
    where: { contentType_contentId_locale: { contentType, contentId, locale } },
  });
}

export async function getTranslationsForContent(contentType: TranslatableKind, contentId: string) {
  return prisma.contentTranslation.findMany({ where: { contentType, contentId } });
}

/**
 * Overlays a published translation's non-null fields onto the base record.
 * en-BD/en-AE are the same language as the default locale, so a missing or
 * unpublished override just falls back to `base` untouched — they always
 * render, with or without a translation row. A different-language locale
 * (bn-BD/ar-AE) with no PUBLISHED translation yet returns null — the
 * caller should notFound() rather than ever show English text standing in
 * for a translation that doesn't exist.
 */
export async function resolveLocalizedContent<T extends { id: string }>(
  contentType: TranslatableKind,
  base: T,
  localeCode: string
): Promise<T | null> {
  const locale = getLocaleByCode(localeCode);
  if (!locale || locale.isDefault) return base;

  const isSameLanguage = locale.language === DEFAULT_LOCALE.language;
  const translation = await getTranslation(contentType, base.id, locale.code);
  if (!translation || translation.status !== "PUBLISHED") {
    return isSameLanguage ? base : null;
  }

  const overlay: Record<string, unknown> = { ...base };
  const fieldMap = TRANSLATION_FIELD_MAP[contentType];
  for (const [translationField, baseField] of Object.entries(fieldMap)) {
    const value = (translation as Record<string, unknown>)[translationField];
    if (value !== null && value !== undefined) {
      overlay[baseField] = value;
    }
  }
  return overlay as T;
}

/**
 * Route resolution for a locale-prefixed detail page: a translated slug
 * takes priority (so a localized URL actually serves the translated
 * content), falling back to the base table's own slug — the normal case
 * for en-BD/en-AE and for any not-yet-localized-slug translation.
 */
export async function findContentIdBySlugInLocale(
  contentType: TranslatableKind,
  localeCode: string,
  slug: string
): Promise<string | null> {
  const locale = getLocaleByCode(localeCode);
  if (locale && !locale.isDefault) {
    const translated = await prisma.contentTranslation.findUnique({
      where: { contentType_locale_slug: { contentType, locale: locale.code, slug } },
    });
    if (translated) return translated.contentId;
  }
  return null;
}

/**
 * Builds the full hreflang set for a piece of content: en-GB (unprefixed)
 * + x-default always; en-BD/en-AE always (fallback content genuinely
 * exists at that URL); bn-BD/ar-AE only when a PUBLISHED translation
 * exists — never advertise a URL that would 404 or silently show the
 * wrong language. `pathBuilder(slug)` returns the un-prefixed path for a
 * given slug, e.g. (slug) => `/blog/${slug}`.
 */
export async function buildHreflangAlternates(
  contentType: TranslatableKind,
  contentId: string,
  defaultSlug: string,
  pathBuilder: (slug: string) => string
): Promise<{ canonical: string; languages: Record<string, string> }> {
  const defaultPath = pathBuilder(defaultSlug);
  const canonical = `${baseUrl}${defaultPath === "/" ? "" : defaultPath}`;
  const languages: Record<string, string> = { [DEFAULT_LOCALE.code]: canonical, "x-default": canonical };

  const translations = await getTranslationsForContent(contentType, contentId);
  const byLocale = new Map(translations.map((t) => [t.locale, t]));

  for (const locale of PREFIXED_LOCALES) {
    const isSameLanguage = locale.language === DEFAULT_LOCALE.language;
    const t = byLocale.get(locale.code);
    const published = t?.status === "PUBLISHED" ? t : null;

    // Different-language + untranslated: don't advertise a URL that would 404.
    if (!isSameLanguage && !published) continue;

    const path = pathBuilder(published?.slug || defaultSlug);
    languages[locale.code] = `${baseUrl}/${locale.prefix}${path === "/" ? "" : path}`;
  }

  return { canonical, languages };
}

/**
 * List-page counterpart to resolveLocalizedContent: for a same-language
 * locale (en-BD/en-AE) every item passes through unchanged (fallback
 * content). For a different-language locale (bn-BD/ar-AE), only items
 * with a PUBLISHED translation are kept — an empty result is the honest,
 * correct state when nothing has been translated yet, never a list of
 * English titles leading to pages that don't exist in that language.
 */
export async function localizeList<T extends { id: string }>(
  contentType: TranslatableKind,
  items: T[],
  localeCode: string
): Promise<T[]> {
  const locale = getLocaleByCode(localeCode);
  if (!locale || locale.isDefault) {
    return items;
  }

  const resolved: (T | null)[] = await Promise.all(
    items.map((item): Promise<T | null> => resolveLocalizedContent<T>(contentType, item, localeCode))
  );
  return resolved.filter((item): item is T => item !== null);
}

// ---- Admin CRUD ----

type TranslationInput = {
  slug?: string | null;
  title?: string | null;
  subtitle?: string | null;
  excerpt?: string | null;
  content?: string | null;
  detailTitle?: string | null;
  detailIntro?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  expectedUpdatedAt?: string | Date | null;
};

export async function saveTranslationDraft(
  contentType: TranslatableKind,
  contentId: string,
  locale: string,
  data: TranslationInput
) {
  try {
    const session = await requirePermission("EDIT");
    const localeConfig = getLocaleByCode(locale);
    if (!localeConfig || localeConfig.isDefault) {
      return { success: false, error: "Invalid locale for a translation" };
    }

    const existing = await getTranslation(contentType, contentId, locale);
    if (existing) {
      const staleError = checkStale(data.expectedUpdatedAt, existing.updatedAt);
      if (staleError) {
        return { success: false, error: staleError, stale: true };
      }
    }

    const fields = {
      slug: data.slug?.trim() || null,
      title: data.title?.trim() || null,
      subtitle: data.subtitle?.trim() || null,
      excerpt: data.excerpt?.trim() || null,
      content: data.content?.trim() || null,
      detailTitle: data.detailTitle?.trim() || null,
      detailIntro: data.detailIntro?.trim() || null,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
      focusKeyword: data.focusKeyword?.trim() || null,
      ogTitle: data.ogTitle?.trim() || null,
      ogDescription: data.ogDescription?.trim() || null,
      twitterTitle: data.twitterTitle?.trim() || null,
      twitterDescription: data.twitterDescription?.trim() || null,
      translatedById: session.user.id,
      translatedByName: session.user.name ?? null,
      translatedByEmail: session.user.email ?? null,
    };

    const translation = await prisma.contentTranslation.upsert({
      where: { contentType_contentId_locale: { contentType, contentId, locale } },
      create: { contentType, contentId, locale, ...fields },
      update: fields,
    });

    revalidatePath("/admin/translations");
    await logAudit({
      action: existing ? "update" : "create",
      category: "Content",
      entityType: "ContentTranslation",
      entityId: translation.id,
      entityLabel: `${contentType} ${contentId} (${locale})`,
      before: existing ?? undefined,
      after: fields,
    });
    return { success: true, translation };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to save translation ${contentType}:${contentId}:${locale}:`, error);
    if (error.code === "P2002") {
      return { success: false, error: "Another translation already uses this localized slug" };
    }
    return { success: false, error: "Failed to save translation" };
  }
}

export async function publishTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  try {
    await requirePermission("PUBLISH");
    const existing = await getTranslation(contentType, contentId, locale);
    if (!existing) {
      return { success: false, error: "Save a draft before publishing" };
    }
    if (!existing.title || !existing.content) {
      return { success: false, error: "Title and content are required before publishing" };
    }

    const translation = await prisma.contentTranslation.update({
      where: { id: existing.id },
      data: { status: "PUBLISHED" },
    });
    revalidatePath("/admin/translations");
    await logAudit({
      action: "publish",
      category: "Content",
      entityType: "ContentTranslation",
      entityId: translation.id,
      entityLabel: `${contentType} ${contentId} (${locale})`,
      before: { status: existing.status },
      after: { status: "PUBLISHED" },
    });
    return { success: true, translation };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to publish translation ${contentType}:${contentId}:${locale}:`, error);
    return { success: false, error: "Failed to publish translation" };
  }
}

export async function unpublishTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  try {
    await requirePermission("PUBLISH");
    const existing = await getTranslation(contentType, contentId, locale);
    if (!existing) {
      return { success: false, error: "Translation not found" };
    }
    const translation = await prisma.contentTranslation.update({ where: { id: existing.id }, data: { status: "DRAFT" } });
    revalidatePath("/admin/translations");
    await logAudit({
      action: "unpublish",
      category: "Content",
      entityType: "ContentTranslation",
      entityId: translation.id,
      entityLabel: `${contentType} ${contentId} (${locale})`,
      before: { status: existing.status },
      after: { status: "DRAFT" },
    });
    return { success: true, translation };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to unpublish translation ${contentType}:${contentId}:${locale}:`, error);
    return { success: false, error: "Failed to unpublish translation" };
  }
}

export async function deleteTranslation(contentType: TranslatableKind, contentId: string, locale: string) {
  try {
    await requirePermission("EDIT");
    const existing = await getTranslation(contentType, contentId, locale);
    if (!existing) {
      return { success: true };
    }
    await prisma.contentTranslation.delete({ where: { id: existing.id } });
    revalidatePath("/admin/translations");
    await logAudit({
      action: "delete",
      category: "Content",
      entityType: "ContentTranslation",
      entityId: existing.id,
      entityLabel: `${contentType} ${contentId} (${locale})`,
      before: existing,
    });
    return { success: true };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to delete translation ${contentType}:${contentId}:${locale}:`, error);
    return { success: false, error: "Failed to delete translation" };
  }
}

/** Status per translatable locale for one content item — drives the admin list's badges. */
export async function getTranslationStatusMap(contentType: TranslatableKind, contentId: string) {
  const emptyMap = () => {
    const map: Record<string, "NOT_STARTED" | "DRAFT" | "PUBLISHED"> = {};
    for (const locale of PREFIXED_LOCALES) map[locale.code] = "NOT_STARTED";
    return map;
  };
  try {
    await requireSession();
    const rows = await getTranslationsForContent(contentType, contentId);
    const byLocale = new Map(rows.map((r) => [r.locale, r.status]));
    const map = emptyMap();
    for (const locale of PREFIXED_LOCALES) {
      map[locale.code] = byLocale.get(locale.code) ?? "NOT_STARTED";
    }
    return map;
  } catch (error) {
    console.error(`Failed to fetch translation status for ${contentType}:${contentId}:`, error);
    return emptyMap();
  }
}
