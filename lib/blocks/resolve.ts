import { isBlockType, parseBlockData, parseStoredBlocks, reusableBlockIds, type ConcreteBlock, type PageBlock } from "./schema";

/** True when `raw` (a stored `blocks` column) references the reusable block `blockId`. Exact match, not substring. */
export function referencesBlock(raw: string | null | undefined, blockId: string): boolean {
  return reusableBlockIds(parseStoredBlocks(raw)).includes(blockId);
}

export type StoredReusable = { type: string; data: string };

/**
 * Replaces every { type: "reusable" } reference with the referenced block's *current* data — this is what makes
 * "edit once, update everywhere" work, since pages store only the id. A reference whose block was deleted, or whose
 * stored data no longer validates, is dropped rather than breaking the page. The reference's own id is kept so
 * React keys stay unique even if the same reusable block is placed twice on one page.
 */
export function resolveBlocks(blocks: PageBlock[], reusable: Map<string, StoredReusable>): ConcreteBlock[] {
  const out: ConcreteBlock[] = [];
  for (const block of blocks) {
    if (block.type !== "reusable") {
      out.push(block);
      continue;
    }
    const stored = reusable.get(block.blockId);
    if (!stored || !isBlockType(stored.type)) continue;
    let data: unknown;
    try {
      data = JSON.parse(stored.data);
    } catch {
      continue;
    }
    const parsed = parseBlockData(stored.type, data);
    if (parsed.ok) out.push({ id: block.id, type: stored.type, data: parsed.value } as ConcreteBlock);
  }
  return out;
}
