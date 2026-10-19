// The 14-category checklist for the Automated SEO Audits feature, in the
// order they're pasted in the spec — kept as a closed list (like
// AuditCategory in lib/audit-log.ts) so every finding commits to one of
// these named buckets.
export const SEO_AUDIT_CATEGORIES = [
  "Missing Title",
  "Duplicate Title",
  "Missing Meta",
  "Duplicate Meta",
  "Missing H1",
  "Multiple H1",
  "Canonical Errors",
  "Noindex Issues",
  "Broken Links",
  "Orphan Pages",
  "Redirect Problems",
  "Schema Problems",
  "Thin Content",
  "Missing Alt",
] as const;

export type SeoAuditCategory = (typeof SEO_AUDIT_CATEGORIES)[number];

export interface SeoAuditFinding {
  category: SeoAuditCategory;
  contentType?: string; // "POST" | "PAGE" | "CASE_STUDY" | "SERVICE", when the finding is tied to one CMS record
  contentId?: string;
  title?: string;
  path: string; // a content path for most categories; an external URL for a Broken Links finding
  detail: string;
}
