import { prisma } from "@/lib/prisma";
import type { LinkSuggestion } from "./types";

export type QaCheckResult = { passed: boolean; note?: string };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Exported for lib/content-recommendations/ (keyword-gap matching reuses the
// exact same word-overlap primitive used here for duplicate-content detection).
export function tokenize(text: string): Set<string> {
  // Words of 4+ characters only — a cheap, dependency-free stand-in for
  // stopword removal that's good enough to stop "the/and/with" noise from
  // dominating the similarity score, without a stopword list to maintain.
  return new Set(text.toLowerCase().split(/\W+/).filter((w) => w.length >= 4));
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

/**
 * Lexical (word-overlap) similarity against every other approved/published
 * Post and CaseStudy — same no-embeddings tradeoff as lib/rag/retrieve.ts
 * and lib/content-search.ts, appropriate at this site's content volume.
 * Not a plagiarism/web-wide check (no such API is configured) — this only
 * ever catches duplication against this site's own other content.
 */
export async function checkDuplicateContent(excludeId: string, contentHtml: string): Promise<QaCheckResult> {
  const ourTokens = tokenize(stripHtml(contentHtml));

  const [posts, caseStudies] = await Promise.all([
    prisma.post.findMany({ where: { id: { not: excludeId }, status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] } }, select: { title: true, slug: true, content: true } }),
    prisma.caseStudy.findMany({ where: { id: { not: excludeId }, status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] } }, select: { title: true, slug: true, content: true } }),
  ]);

  let worst: { title: string; slug: string; similarity: number } | null = null;
  for (const item of [...posts, ...caseStudies]) {
    const similarity = jaccardSimilarity(ourTokens, tokenize(stripHtml(item.content)));
    if (!worst || similarity > worst.similarity) worst = { title: item.title, slug: item.slug, similarity };
  }

  if (worst && worst.similarity >= DUPLICATE_SIMILARITY_THRESHOLD) {
    return { passed: false, note: `${Math.round(worst.similarity * 100)}% word overlap with "${worst.title}" (/${worst.slug})` };
  }
  return { passed: true };
}

/**
 * Re-verifies, at QA time, that every link the Internal Links stage
 * applied is still actually present in the final content — catches a
 * link accidentally stripped by a later edit between stages. External
 * links are counted but not live-checked here; this project already has
 * a dedicated Link Monitor (/admin/link-monitor) for that, on its own
 * cron schedule — duplicating a live HTTP check inside a synchronous QA
 * stage would be slow and unreliable for no real benefit.
 */
export function checkLinks(contentHtml: string, appliedLinks: LinkSuggestion[] | null): QaCheckResult {
  const applied = (appliedLinks || []).filter((l) => l.applied);
  const externalCount = (contentHtml.match(/<a\s+[^>]*href="https?:\/\/[^"]*"/gi) || []).length;

  if (applied.length === 0) {
    return { passed: true, note: externalCount > 0 ? `No internal links; ${externalCount} external link(s) present.` : "No links applied." };
  }

  const missing = applied.filter((l) => !contentHtml.includes(l.targetUrl));
  if (missing.length > 0) {
    return { passed: false, note: `${missing.length} previously-applied internal link(s) are missing from the final content.` };
  }
  return {
    passed: true,
    note: `${applied.length} internal link(s) verified present.${externalCount > 0 ? ` ${externalCount} external link(s) present (see Link Monitor for live checks).` : ""}`,
  };
}

/** Structural validity, not just presence — matches the required fields the Schema stage's own prompt demands. */
export function checkSchema(schemaJson: string | null): QaCheckResult {
  if (!schemaJson) return { passed: false, note: "No schema.org data present" };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(schemaJson);
  } catch {
    return { passed: false, note: "Stored schema is not valid JSON" };
  }
  const required = ["@context", "@type", "headline", "datePublished", "mainEntityOfPage"];
  const missing = required.filter((key) => !parsed[key]);
  if (missing.length > 0) return { passed: false, note: `Missing required field(s): ${missing.join(", ")}` };
  return { passed: true };
}

export function checkMetadata(content: {
  focusKeyword: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
}): QaCheckResult {
  const missing: string[] = [];
  if (!content.focusKeyword?.trim()) missing.push("focus keyword");
  if (!content.ogTitle?.trim()) missing.push("OG title");
  if (!content.ogDescription?.trim()) missing.push("OG description");
  if (!content.twitterTitle?.trim()) missing.push("Twitter title");
  if (!content.twitterDescription?.trim()) missing.push("Twitter description");
  if (missing.length > 0) return { passed: false, note: `Missing: ${missing.join(", ")}` };
  return { passed: true };
}

/** N/A (passes) when there's no featured image at all — the Image stage is optional (Skip), so having none is never itself a failure. */
export function checkAltText(featuredImage: string | null, featuredImageAlt: string | null): QaCheckResult {
  if (!featuredImage) return { passed: true, note: "No featured image set" };
  if (!featuredImageAlt?.trim() || featuredImageAlt.includes("pending alt text")) {
    return { passed: false, note: "Featured image has no real alt text" };
  }
  return { passed: true };
}

export function checkSeoHeadings(contentHtml: string, primaryKeyword: string): QaCheckResult {
  const headings = (contentHtml.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi) || []).map((h) => stripHtml(h).toLowerCase());
  const found = headings.some((h) => h.includes(primaryKeyword.toLowerCase()));
  return { passed: found, note: found ? undefined : "The target keyword doesn't appear in any H2/H3 heading" };
}
