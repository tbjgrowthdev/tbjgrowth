// Shared by every admin form's SeoPanel integration and by anything that
// reads a Post/Page/CaseStudy/AgencyService's `secondaryKeywords` column —
// one JSON string[] column, parsed defensively since it's hand-typed by an
// admin (or written by the AI pipeline's Publish stage) rather than
// schema-validated at the database level.
export function parseSecondaryKeywords(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string" && k.trim().length > 0) : [];
  } catch {
    return [];
  }
}
