import prisma from "@/lib/prisma";

// Replaces a post's or case study's categories/tags without a nested
// `{ set: [...] }` write.
//
// Production talks to Neon through PrismaNeonHttp (see lib/prisma.ts), which
// rejects anything Prisma runs inside a transaction. A nested `set` on a
// many-to-many relation is "remove every link, then add the new ones" — more
// than one statement, so Prisma wraps it in a transaction and the whole
// update fails. This helper diffs the current links against the wanted ones
// and applies each change as its own single-link update, run concurrently —
// the same shape app/(admin)/actions/bulk-posts.ts already uses live.
// Each step is idempotent, so a retry after a partial failure converges.

type RelationContentType = "POST" | "CASE_STUDY";
type LinkRow = { id: string };
type RelationDelegate = {
  findUnique(args: unknown): Promise<{ categories: LinkRow[]; tags: LinkRow[] } | null>;
  update(args: unknown): Promise<unknown>;
};

function delegateFor(type: RelationContentType): RelationDelegate {
  return (type === "POST" ? prisma.post : prisma.caseStudy) as unknown as RelationDelegate;
}

/**
 * Makes the record's categories/tags exactly match the given ID lists. A
 * list left undefined (not just empty) leaves that relation untouched,
 * matching the old `data.categoryIds ? { set } : undefined` behaviour.
 */
export async function syncTaxonomy(
  type: RelationContentType,
  id: string,
  wanted: { categoryIds?: string[] | null; tagIds?: string[] | null }
): Promise<void> {
  const fields = (["categories", "tags"] as const).filter((field) => Array.isArray(field === "categories" ? wanted.categoryIds : wanted.tagIds));
  if (fields.length === 0) return;

  const delegate = delegateFor(type);
  const current = await delegate.findUnique({
    where: { id },
    select: { categories: { select: { id: true } }, tags: { select: { id: true } } },
  });
  if (!current) throw new Error(`${type === "POST" ? "Post" : "Case study"} ${id} not found`);

  const writes: Promise<unknown>[] = [];
  for (const field of fields) {
    const want = new Set((field === "categories" ? wanted.categoryIds : wanted.tagIds) ?? []);
    const have = new Set(current[field].map((row) => row.id));
    for (const linkId of want) {
      if (!have.has(linkId)) writes.push(delegate.update({ where: { id }, data: { [field]: { connect: { id: linkId } } }, select: { id: true } }));
    }
    for (const linkId of have) {
      if (!want.has(linkId)) writes.push(delegate.update({ where: { id }, data: { [field]: { disconnect: { id: linkId } } }, select: { id: true } }));
    }
  }
  await Promise.all(writes);
}
