// Run with: npm test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

// A fake post delegate that records every update. The point of syncTaxonomy
// is that no single update carries a nested `set` (which needs a transaction
// the production Neon HTTP adapter rejects) — only one connect or disconnect each.
let current: { categories: { id: string }[]; tags: { id: string }[] } | null;
let updates: { data: Record<string, unknown> }[];
const fakeDelegate = {
  findUnique: async () => current,
  update: async (args: { data: Record<string, unknown> }) => void updates.push(args),
};
const fakePrisma = { post: fakeDelegate, caseStudy: fakeDelegate };
mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });

const { syncTaxonomy } = await import("../lib/content-relations");

beforeEach(() => {
  current = { categories: [{ id: "c1" }, { id: "c2" }], tags: [{ id: "t1" }] };
  updates = [];
});

test("adds missing links and removes extra ones, one link per update, never a nested set", async () => {
  await syncTaxonomy("POST", "p1", { categoryIds: ["c2", "c3"], tagIds: [] });
  const ops = updates.map((u) => JSON.stringify(u.data)).sort();
  assert.deepEqual(ops, [
    JSON.stringify({ categories: { connect: { id: "c3" } } }),
    JSON.stringify({ categories: { disconnect: { id: "c1" } } }),
    JSON.stringify({ tags: { disconnect: { id: "t1" } } }),
  ].sort());
  assert.ok(updates.every((u) => !JSON.stringify(u.data).includes('"set"')));
});

test("no changes means no writes", async () => {
  await syncTaxonomy("POST", "p1", { categoryIds: ["c1", "c2"], tagIds: ["t1"] });
  assert.equal(updates.length, 0);
});

test("an undefined list leaves that relation alone", async () => {
  await syncTaxonomy("POST", "p1", { tagIds: ["t2"] });
  const ops = updates.map((u) => JSON.stringify(u.data)).sort();
  assert.deepEqual(ops, [JSON.stringify({ tags: { connect: { id: "t2" } } }), JSON.stringify({ tags: { disconnect: { id: "t1" } } })].sort());
});

test("a missing record is an error, not a silent no-op", async () => {
  current = null;
  await assert.rejects(syncTaxonomy("CASE_STUDY", "nope", { tagIds: [] }), /not found/);
});
