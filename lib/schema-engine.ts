/**
 * Full Schema Engine.
 *
 * The single place that decides which schema.org @type applies to which
 * content type, and whether a manual override takes precedence. It never
 * invents a JSON-LD shape of its own — it only dispatches to the builders in
 * lib/schema.ts, which already carry the "only real data, never fabricated"
 * rule documented there.
 *
 * Content-type -> automatic schema type:
 *   POST, CASE_STUDY -> Article
 *   SERVICE          -> Service
 *   PAGE             -> none (generic pages get breadcrumb only)
 *
 * Organization / LocalBusiness (site-wide, app/(public)/[locale]/layout.tsx),
 * Review (site-wide testimonials, Testimonials.tsx), Product (pricing plans,
 * pricing/page.tsx), FAQ (sitewide Faq.tsx and per-service FAQs) and
 * Breadcrumb (every detail page) are not per-content-record overrides — they
 * already auto-generate from their own real data sources and have no
 * schemaJson field to override, so this engine doesn't touch them.
 */

import { articleSchema, serviceSchema } from "./schema";

export type SchemaContentType = "POST" | "CASE_STUDY" | "SERVICE" | "PAGE";

export const AUTO_SCHEMA_TYPE: Record<SchemaContentType, string | null> = {
  POST: "Article",
  CASE_STUDY: "Article",
  SERVICE: "Service",
  PAGE: null,
};

export interface SchemaEngineInput {
  contentType: SchemaContentType;
  id?: string;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  description?: string | null; // Service
  featuredImage?: string | null;
  authorName?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

function pathFor(input: SchemaEngineInput): string {
  const slug = input.slug || input.id || "";
  switch (input.contentType) {
    case "POST":
      return `/blog/${slug}`;
    case "CASE_STUDY":
      return `/case-studies/${slug}`;
    case "SERVICE":
      return `/services/${slug}`;
    default:
      return `/${slug}`;
  }
}

// Returns the auto-generated JSON-LD object for this content record, or
// null when the content type has no automatic schema (PAGE) or the record
// doesn't yet have the minimum data (a title) to build one.
export function buildAutoSchema(input: SchemaEngineInput): Record<string, unknown> | null {
  if (!input.title) return null;

  switch (input.contentType) {
    case "POST":
    case "CASE_STUDY":
      return articleSchema({
        title: input.title,
        path: pathFor(input),
        excerpt: input.excerpt,
        featuredImage: input.featuredImage,
        authorName: input.authorName,
        createdAt: input.createdAt || new Date(),
        updatedAt: input.updatedAt || new Date(),
      });
    case "SERVICE":
      return serviceSchema({
        title: input.title,
        description: input.description || "",
        slug: input.slug,
        id: input.id || "",
      });
    case "PAGE":
    default:
      return null;
  }
}
