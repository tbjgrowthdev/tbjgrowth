import prisma from "@/lib/prisma";
import { parseStoredBlocks, reusableBlockIds } from "./schema";
import { referencesBlock } from "./resolve";

export type BlockUsage = {
  pages: { id: string; title: string; slug: string }[];
  templates: { id: string; name: string }[];
};

/**
 * Where a reusable block is used. The database does a cheap substring pre-filter on the id (a cuid), then each hit
 * is re-checked by parsing, so a block id that merely appears inside some other text never counts as usage.
 * There is no join table by design — see the ContentBlock model comment.
 */
export async function findBlockUsage(blockId: string): Promise<BlockUsage> {
  const [pages, templates] = await Promise.all([
    prisma.page.findMany({ where: { blocks: { contains: blockId } }, select: { id: true, title: true, slug: true, blocks: true } }),
    prisma.pSeoTemplate.findMany({ where: { blocks: { contains: blockId } }, select: { id: true, name: true, blocks: true } }),
  ]);
  return {
    pages: pages.filter((p) => referencesBlock(p.blocks, blockId)).map(({ id, title, slug }) => ({ id, title, slug })),
    templates: templates.filter((t) => referencesBlock(t.blocks, blockId)).map(({ id, name }) => ({ id, name })),
  };
}

/** Usage counts for every reusable block at once (for the list screen) — two queries instead of two per block. */
export async function countAllBlockUsage(): Promise<Map<string, number>> {
  const [pages, templates] = await Promise.all([
    prisma.page.findMany({ where: { blocks: { not: null } }, select: { blocks: true } }),
    prisma.pSeoTemplate.findMany({ where: { blocks: { not: null } }, select: { blocks: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const row of [...pages, ...templates]) {
    for (const id of reusableBlockIds(parseStoredBlocks(row.blocks))) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
