import type { ExperimentContentType } from "@/lib/seo-experiments/types";

export type SeoChangeField =
  | "title"
  | "slug"
  | "metaTitle"
  | "metaDescription"
  | "focusKeyword"
  | "secondaryKeywords"
  | "canonicalUrl"
  | "schemaJson"
  | "isIndexable"
  | "allowFollow"
  | "maxSnippet"
  | "maxImagePreview"
  | "maxVideoPreview"
  | "ogImage"
  | "ogTitle"
  | "ogDescription"
  | "twitterCard"
  | "twitterTitle"
  | "twitterDescription"
  | "twitterImage";

// Watched in this fixed order (also the display order) — anything outside
// this list is a non-SEO field change and is left to the general audit log.
export const SEO_CHANGE_FIELDS: SeoChangeField[] = [
  "metaTitle",
  "metaDescription",
  "focusKeyword",
  "secondaryKeywords",
  "slug",
  "canonicalUrl",
  "schemaJson",
  "isIndexable",
  "allowFollow",
  "maxSnippet",
  "maxImagePreview",
  "maxVideoPreview",
  "ogTitle",
  "ogDescription",
  "ogImage",
  "twitterTitle",
  "twitterDescription",
  "twitterCard",
  "twitterImage",
  "title",
];

export const SEO_FIELD_LABELS: Record<SeoChangeField, string> = {
  title: "Title",
  slug: "Slug",
  metaTitle: "Meta Title",
  metaDescription: "Meta Description",
  focusKeyword: "Focus Keyword",
  secondaryKeywords: "Secondary Keywords",
  canonicalUrl: "Canonical URL",
  schemaJson: "Schema Override",
  isIndexable: "Indexable",
  allowFollow: "Follow Links",
  maxSnippet: "Max Snippet",
  maxImagePreview: "Max Image Preview",
  maxVideoPreview: "Max Video Preview",
  ogImage: "OG Image",
  ogTitle: "OG Title",
  ogDescription: "OG Description",
  twitterCard: "Twitter Card",
  twitterTitle: "Twitter Title",
  twitterDescription: "Twitter Description",
  twitterImage: "Twitter Image",
};

export interface SeoChangeEntry {
  id: string; // auditLogId:field — unique per row
  auditLogId: string;
  contentType: ExperimentContentType;
  contentId: string;
  contentTitle: string | null;
  contentPath: string | null;
  field: SeoChangeField;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  changedBy: string | null;
}
