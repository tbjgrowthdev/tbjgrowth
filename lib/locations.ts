/**
 * Shared parsing for Location's JSON text fields. Same shape/convention as
 * lib/service-content.ts's AgencyService helpers — one place so the admin
 * form, the public location page, and the Local SEO schema builder all
 * agree on what a stored value means.
 */
export function parseServiceAreas(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === "string" && a.trim().length > 0) : [];
  } catch {
    return [];
  }
}
