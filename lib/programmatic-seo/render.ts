import { slugify } from "@/lib/utils";

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Replaces every {{column}} placeholder with the row's value for that
 * column. Row values come from an admin-uploaded CSV, not admin-typed
 * markup, so they're always HTML-escaped on the way in — only the
 * template string itself (authored by an admin, same trust level as
 * AgencyService.content) is allowed to carry real HTML. A placeholder
 * naming a column the row doesn't have is left exactly as-is, so a typo'd
 * {{column}} name is visibly obvious in the rendered output rather than
 * silently disappearing.
 */
export function renderTemplate(template: string, data: Record<string, string>, escapeValues = true): string {
  return template.replace(PLACEHOLDER_PATTERN, (match, column) => {
    if (!(column in data)) return match;
    const value = data[column] ?? "";
    return escapeValues ? escapeHtml(value) : value;
  });
}

/** Same placeholder substitution, but for the slug — never HTML-escaped, always slugified afterward. */
export function renderSlug(slugTemplate: string, data: Record<string, string>): string {
  const rendered = renderTemplate(slugTemplate, data, false);
  return slugify(rendered);
}

/** Every {{column}} name referenced anywhere across a template's fields — used to warn when a dataset's CSV headers don't cover what the template actually needs. */
export function extractPlaceholders(...templates: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of templates) {
    if (!t) continue;
    for (const m of t.matchAll(PLACEHOLDER_PATTERN)) found.add(m[1]);
  }
  return Array.from(found);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function countWords(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
