// Closed-set locale registry — same spirit as ROLE_PERMISSIONS in
// lib/permissions.ts, not DB-driven. en-GB is the only locale with
// prefix: null; it's the site's existing content and never appears in a
// URL segment. The other four are added later if a market needs splitting
// (e.g. a dedicated ar-SA) without any schema change — ContentTranslation
// and middleware both key off plain locale strings.
export type LocaleCode = "en-GB" | "en-BD" | "bn-BD" | "en-AE" | "ar-AE";
export type Market = "uk" | "bangladesh" | "gulf";

export interface LocaleConfig {
  code: LocaleCode;
  prefix: string | null; // lowercase URL segment, e.g. "bn-bd" — null only for en-GB
  market: Market;
  language: "en" | "bn" | "ar";
  region: "GB" | "BD" | "AE";
  label: string;
  dir: "ltr" | "rtl";
  isDefault: boolean;
}

export const LOCALES: LocaleConfig[] = [
  { code: "en-GB", prefix: null, market: "uk", language: "en", region: "GB", label: "English (UK)", dir: "ltr", isDefault: true },
  { code: "en-BD", prefix: "en-bd", market: "bangladesh", language: "en", region: "BD", label: "English (Bangladesh)", dir: "ltr", isDefault: false },
  { code: "bn-BD", prefix: "bn-bd", market: "bangladesh", language: "bn", region: "BD", label: "বাংলা (বাংলাদেশ)", dir: "ltr", isDefault: false },
  { code: "en-AE", prefix: "en-ae", market: "gulf", language: "en", region: "AE", label: "English (Gulf)", dir: "ltr", isDefault: false },
  { code: "ar-AE", prefix: "ar-ae", market: "gulf", language: "ar", region: "AE", label: "العربية (الخليج)", dir: "rtl", isDefault: false },
];

export const DEFAULT_LOCALE: LocaleConfig = LOCALES[0];
export const PREFIXED_LOCALES: LocaleConfig[] = LOCALES.filter((l) => !l.isDefault);
// Locales that are a genuinely different language from the default — these
// are the ones that require a published ContentTranslation before their
// URL/hreflang entry exists at all. en-BD/en-AE are the same language as
// the default (en-GB), so they always render via fallback — see
// lib/translation.ts's resolveLocalizedContent.
export const TRANSLATABLE_LOCALES: LocaleConfig[] = PREFIXED_LOCALES.filter((l) => l.language !== DEFAULT_LOCALE.language);

export function getLocaleByPrefix(prefix: string | null | undefined): LocaleConfig | null {
  if (!prefix) return null;
  return PREFIXED_LOCALES.find((l) => l.prefix === prefix.toLowerCase()) ?? null;
}

export function getLocaleByCode(code: string | null | undefined): LocaleConfig | null {
  if (!code) return null;
  return LOCALES.find((l) => l.code.toLowerCase() === code.toLowerCase()) ?? null;
}

/** True for any of the 4 non-default locale prefixes ("en-bd", "bn-bd", "en-ae", "ar-ae"). */
export function isKnownLocalePrefix(segment: string): boolean {
  return getLocaleByPrefix(segment) !== null;
}

/**
 * Resolves the `[locale]` route param to a LocaleConfig. "en-gb" is a
 * special case: it never appears as a real URL (middleware only ever
 * rewrites an unprefixed request to it internally, and redirects away from
 * it if anyone requests it explicitly) but it's still the literal param
 * value Next.js hands every page/layout under app/(public)/[locale] for
 * the default locale. Returns null for anything else unrecognized, which
 * callers should treat as notFound().
 */
export function resolveRouteLocale(param: string | null | undefined): LocaleConfig | null {
  if (!param) return null;
  if (param.toLowerCase() === "en-gb") return DEFAULT_LOCALE;
  return getLocaleByPrefix(param);
}

/** Joins a locale prefix (or null for the default) with an unprefixed path like "/blog/my-post". */
export function withLocalePrefix(prefix: string | null, path: string): string {
  if (!prefix) return path;
  return `/${prefix}${path === "/" ? "" : path}`;
}
