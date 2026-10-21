import { tokenize, jaccardSimilarity } from "@/lib/content-pipeline/quality-gate";
import type { GuardrailFinding } from "./types";

/** A row missing any column the template marked required — the row doesn't carry enough real information for this to be worth a page at all. */
export function checkRequiredColumns(data: Record<string, string>, requiredColumns: string[]): GuardrailFinding | null {
  const missing = requiredColumns.filter((col) => !data[col]?.trim());
  if (missing.length === 0) return null;
  return { category: "LOW_VALUE", description: `Missing required value${missing.length > 1 ? "s" : ""} for: ${missing.join(", ")}` };
}

/** Rendered body falls short of the template's own minimum word count. */
export function checkThinContent(wordCount: number, minWordCount: number): GuardrailFinding | null {
  if (wordCount >= minWordCount) return null;
  return { category: "THIN_CONTENT", description: `Body is ${wordCount} word${wordCount === 1 ? "" : "s"}, below the ${minWordCount}-word minimum for this template` };
}

/**
 * Word-overlap similarity against every other page already generated from
 * this template (same Jaccard primitive, same accepted O(n) comparisons
 * per page as lib/content-pipeline/quality-gate.ts's duplicate-content
 * check and lib/content-cannibalization/detect.ts) — catches a template
 * that doesn't vary enough between rows, which is the actual mechanism by
 * which programmatic SEO mass-produces near-identical pages.
 */
export function checkDuplicate(bodyText: string, others: { label: string; bodyText: string }[], threshold: number): GuardrailFinding | null {
  const ownTokens = tokenize(bodyText);
  let worst: { label: string; similarity: number } | null = null;
  for (const other of others) {
    const similarity = jaccardSimilarity(ownTokens, tokenize(other.bodyText));
    if (!worst || similarity > worst.similarity) worst = { label: other.label, similarity };
  }
  if (!worst || worst.similarity < threshold) return null;
  return { category: "DUPLICATE", description: `${Math.round(worst.similarity * 100)}% word overlap with "${worst.label}"` };
}
