// Client-safe description of the case study form fields an "Import JSON" file may carry. The names are the form's own
// (components/Admin/CaseStudyForm.tsx formData), so a file can be prepared from the form itself. Validation lives in
// lib/case-study-import.ts (server only); this file has no zod / sanitize-html so the admin browser bundle stays small.

export const CASE_STUDY_TEXT_FIELDS = [
  "title", "slug", "clientName", "industry", "serviceType", "results", "excerpt", "websiteUrl",
  "featuredImage", "featuredImageAlt", "content",
  "metaTitle", "metaDescription", "focusKeyword", "canonicalUrl",
  "twitterCard", "ogImage", "ogTitle", "ogDescription", "twitterTitle", "twitterDescription", "twitterImage",
  "schemaJson", "maxImagePreview",
] as const;
export const CASE_STUDY_LIST_FIELDS = ["imageGallery", "secondaryKeywords"] as const;
export const CASE_STUDY_BOOLEAN_FIELDS = ["isFeatured", "isIndexable", "allowFollow"] as const;
export const CASE_STUDY_NUMBER_FIELDS = ["maxSnippet", "maxVideoPreview"] as const;

export const CASE_STUDY_IMPORT_KEYS: readonly string[] = [
  ...CASE_STUDY_TEXT_FIELDS, ...CASE_STUDY_LIST_FIELDS, ...CASE_STUDY_BOOLEAN_FIELDS, ...CASE_STUDY_NUMBER_FIELDS,
];

/** Every key a file may contain: the form fields plus the block list. */
export const IMPORT_KNOWN_KEYS: readonly string[] = [...CASE_STUDY_IMPORT_KEYS, "blocks"];

/** Fields the form must never take from a file (workflow / bookkeeping). Reported as a specific warning. */
export const IMPORT_FORBIDDEN_KEYS: readonly string[] = ["status", "id", "authorId", "publishedAt", "createdAt", "updatedAt", "reviewerId", "seoReviewerId", "approverId"];

/** What an untouched form holds, so booleans / numbers can be told apart from "filled in" values. */
export const CASE_STUDY_FIELD_DEFAULTS: Record<string, unknown> = {
  isFeatured: false, isIndexable: true, allowFollow: true, maxSnippet: -1, maxVideoPreview: -1, maxImagePreview: "large",
};

export type CaseStudyImportFields = Partial<Record<(typeof CASE_STUDY_TEXT_FIELDS)[number], string>> &
  Partial<Record<(typeof CASE_STUDY_LIST_FIELDS)[number], string[]>> &
  Partial<Record<(typeof CASE_STUDY_BOOLEAN_FIELDS)[number], boolean>> &
  Partial<Record<(typeof CASE_STUDY_NUMBER_FIELDS)[number], number>>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** True when the form already holds a real value for `key` (strings/lists non-empty; booleans/numbers not at their default). */
export function isFilled(key: string, value: unknown): boolean {
  if (typeof value === "string") {
    // The form's own default for these is "large", which is not something the admin typed.
    return key in CASE_STUDY_FIELD_DEFAULTS ? !same(value, CASE_STUDY_FIELD_DEFAULTS[key]) : value.trim().length > 0;
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean" || typeof value === "number") return key in CASE_STUDY_FIELD_DEFAULTS ? !same(value, CASE_STUDY_FIELD_DEFAULTS[key]) : false;
  return false;
}

/** Imported fields whose current form value is filled in AND different — i.e. what an overwrite would actually change. */
export function conflictingFields(current: Record<string, unknown>, incoming: Record<string, unknown>): string[] {
  return Object.keys(incoming).filter((k) => isFilled(k, current[k]) && !same(current[k], incoming[k]));
}

/**
 * Which imported fields reach the form. "overwrite" applies all of them; "fill-empty" applies only those the form
 * has no real value for. Fields absent from the file are never touched (an import never clears anything).
 */
export function planFieldMerge(current: Record<string, unknown>, incoming: Record<string, unknown>, mode: "overwrite" | "fill-empty") {
  const apply: Record<string, unknown> = {};
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (mode === "overwrite" || !isFilled(k, current[k])) apply[k] = v;
    else if (!same(current[k], v)) skipped.push(k);
  }
  return { apply, skipped };
}
