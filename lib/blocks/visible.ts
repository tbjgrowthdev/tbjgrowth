import { isDisplayableImageUrl } from "@/lib/image-hosts";

// Pure "what actually renders" rules for the case-study blocks, shared by the renderer and the tests. Placeholders
// must never reach a public page, so anything incomplete is filtered here rather than inside JSX.

export type ProofItem = { imageUrl: string; imageAlt: string; caption: string; badge: string };

/** Gallery items with a displayable image. An empty result means the whole block renders nothing. */
export function visibleProofItems<T extends Pick<ProofItem, "imageUrl">>(items: T[]): T[] {
  return items.filter((i) => Boolean(i.imageUrl) && isDisplayableImageUrl(i.imageUrl));
}

export function hasQuote(quote: string): boolean {
  return quote.trim().length > 0;
}

/** Whether a cards block shows its intro below the cards (a note) instead of above (a lead-in). */
export function introIsBelow(variant: string, placement: string | undefined): boolean {
  return placement === "below" || ((placement === undefined || placement === "auto") && variant === "stats");
}

/**
 * A closing disclaimer: sanitized richText that is one short paragraph and nothing else (no heading, list or image).
 * The case study layout shows it as a small footnote instead of a full prose section.
 */
export function isFootnoteHtml(html: string, maxChars = 200): boolean {
  const m = /^\s*<p[^>]*>([\s\S]*?)<\/p>\s*$/i.exec(html);
  if (!m || /<p[\s>]/i.test(m[1])) return false;
  if (/<(img|iframe|ul|ol|h[1-6]|table|blockquote|br)\b/i.test(m[1])) return false;
  const text = m[1].replace(/<[^>]*>/g, "").trim();
  return text.length > 0 && text.length <= maxChars;
}

export function tableIsRenderable(columns: string[], rows: string[][]): boolean {
  return columns.length > 0 && rows.length > 0;
}
