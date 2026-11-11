// Covers checkAndTouchAdminSession: one AdminSession read decides
// missing / revoked / active and refreshes lastSeenAt only when stale.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Row = { id: string; revokedAt: Date | null; lastSeenAt: Date };
let row: Row | null = null;
let finds = 0;
let updates: Date[] = [];
let failUpdate = false;

const fakePrisma = {
  adminSession: {
    async findUnique() {
      finds++;
      return row ? { ...row } : null;
    },
    async update({ data }: { data: { lastSeenAt: Date } }) {
      if (failUpdate) throw new Error("write failed");
      updates.push(data.lastSeenAt);
      return {};
    },
  },
};
mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });

const { checkAndTouchAdminSession } = await import("@/lib/session-tracking");

beforeEach(() => {
  row = null;
  finds = 0;
  updates = [];
  failUpdate = false;
});

const ago = (ms: number) => new Date(Date.now() - ms);

test("no session id is missing and does no query", async () => {
  assert.equal(await checkAndTouchAdminSession(undefined), "missing");
  assert.equal(await checkAndTouchAdminSession(null), "missing");
  assert.equal(finds, 0);
});

test("unknown session row is missing", async () => {
  assert.equal(await checkAndTouchAdminSession("s1"), "missing");
  assert.equal(finds, 1);
  assert.equal(updates.length, 0);
});

test("revoked session is refused and not touched", async () => {
  row = { id: "s1", revokedAt: new Date(), lastSeenAt: ago(60 * 60 * 1000) };
  assert.equal(await checkAndTouchAdminSession("s1"), "revoked");
  assert.equal(updates.length, 0);
});

test("fresh lastSeenAt: active, single read, no write", async () => {
  row = { id: "s1", revokedAt: null, lastSeenAt: ago(60 * 1000) };
  assert.equal(await checkAndTouchAdminSession("s1"), "active");
  assert.equal(finds, 1);
  assert.equal(updates.length, 0);
});

test("stale lastSeenAt: active, single read, one write", async () => {
  row = { id: "s1", revokedAt: null, lastSeenAt: ago(10 * 60 * 1000) };
  assert.equal(await checkAndTouchAdminSession("s1"), "active");
  assert.equal(finds, 1);
  assert.equal(updates.length, 1);
});

test("a failed touch write does not fail the session", async () => {
  row = { id: "s1", revokedAt: null, lastSeenAt: ago(10 * 60 * 1000) };
  failUpdate = true;
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await checkAndTouchAdminSession("s1"), "active");
  } finally {
    console.error = original;
  }
});
