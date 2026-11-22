// Run with: npm test
//
// tests/helpers/fake-prisma.ts must treat `undefined` like Prisma does:
// an undefined field in `data` or `where` is ignored, never written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";

test("undefined in create data is ignored (the field stays absent, not set to undefined)", async () => {
  const db = createFakePrisma(CLIENT_HUB_SCHEMA);
  await db.client.create({ data: { id: "c1", name: "Acme", whatsapp: undefined } });
  const row = (db._tables as Record<string, Row[]>).client[0];
  assert.equal("whatsapp" in row, false);
});

test("undefined in update data leaves the stored value unchanged", async () => {
  const db = createFakePrisma(CLIENT_HUB_SCHEMA);
  await db.client.create({ data: { id: "c1", name: "Acme", phone: "+880" } });
  await db.client.update({ where: { id: "c1" }, data: { name: "Acme 2", phone: undefined } });
  const row = (db._tables as Record<string, Row[]>).client[0];
  assert.equal(row.phone, "+880");
  assert.equal(row.name, "Acme 2");
});
