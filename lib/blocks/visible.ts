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

export function tableIsRenderable(columns: string[], rows: string[][]): boolean {
  return columns.length > 0 && rows.length > 0;
}
