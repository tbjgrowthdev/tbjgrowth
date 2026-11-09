import { normalizeBlocksInput } from "./schema";

/**
 * Shared by the Page / CaseStudy save actions. `blocks` is only written when the caller sent it, so an older caller
 * (or the classic editor) can never wipe a layout by omission. An empty list becomes null = the classic layout.
 */
export function blocksUpdate(input: unknown): { ok: true; data: { blocks?: string | null } } | { ok: false; error: string } {
  if (input === undefined) return { ok: true, data: {} };
  const result = normalizeBlocksInput(input);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { blocks: result.value.json } };
}
