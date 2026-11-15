// Run with: npm test
//
// Drives the newsletter Server Actions (app/(admin)/actions/newsletter.ts)
// against an in-memory fake table, plus the CSV export helper.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Row = {
  id: string;
  email: string;
  source: string;
  path: string | null;
  locale: string | null;
  status: "ACTIVE" | "UNSUBSCRIBED";
  unsubscribedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const rows = new Map<string, Row>(); // by email
let nextId = 1;
let allowRateLimit = true;
let permissionDenied = false;
let failNextUpsertWith: unknown = null;
const auditEntries: Array<Record<string, unknown>> = [];

class AuthError extends Error {}

const fakePrisma = {
  newsletterSubscriber: {
    async upsert({ where, create, update }: { where: { email: string }; create: Partial<Row>; update: Partial<Row> }) {
      if (failNextUpsertWith) {
        const err = failNextUpsertWith;
        failNextUpsertWith = null;
        throw err;
      }
      const now = new Date();
      const existing = rows.get(where.email);
      const row: Row = existing
        ? { ...existing, ...update, updatedAt: now }
        : { id: `sub_${nextId++}`, path: null, locale: null, status: "ACTIVE", unsubscribedAt: null, createdAt: now, updatedAt: now, ...create } as Row;
      rows.set(row.email, row);
      return { ...row };
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Row> }) {
      const row = [...rows.values()].find((r) => r.id === where.id);
      if (!row) throw new Error("Record not found");
      Object.assign(row, data);
      return { ...row };
    },
    async delete({ where }: { where: { id: string } }) {
      const row = [...rows.values()].find((r) => r.id === where.id);
      if (!row) throw new Error("Record not found");
      rows.delete(row.email);
      return { ...row };
    },
    async findMany({ where = {} }: { where?: Partial<Row> }) {
      return [...rows.values()].filter((r) => (!where.source || r.source === where.source) && (!where.status || r.status === where.status));
    },
    async count({ where = {} }: { where?: Partial<Row> }) {
      return (await this.findMany({ where })).length;
    },
    async groupBy() {
      const groups = new Map<string, { source: string; status: string; _count: { _all: number } }>();
      for (const r of rows.values()) {
        const key = `${r.source}|${r.status}`;
        const g = groups.get(key) ?? { source: r.source, status: r.status, _count: { _all: 0 } };
        g._count._all++;
        groups.set(key, g);
      }
      return [...groups.values()];
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requirePermission: async () => {
      if (permissionDenied) throw new AuthError("Forbidden");
      return { user: { id: "user_1", role: "ADMIN" } };
    },
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (entry: Record<string, unknown>) => void auditEntries.push(entry) } });
mock.module("@/lib/rate-limit", { namedExports: { withinIpAndGlobalLimits: async () => allowRateLimit } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/headers", { namedExports: { headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.7" }) } });

// Imported after the mocks are registered.
const actions = await import("../app/(admin)/actions/newsletter");
const { subscribersToCsv } = await import("../lib/newsletter");

beforeEach(() => {
  rows.clear();
  nextId = 1;
  allowRateLimit = true;
  permissionDenied = false;
  failNextUpsertWith = null;
  auditEntries.length = 0;
});

test("saves a signup with its source, page and locale, lowercasing the email", async () => {
  const result = await actions.subscribeToNewsletter({ email: "  Jane@Example.COM ", source: "blog", path: "/en/blog", locale: "en" });
  assert.deepEqual(result, { success: true });
  const row = rows.get("jane@example.com");
  assert.ok(row);
  assert.equal(row.source, "blog");
  assert.equal(row.path, "/en/blog");
  assert.equal(row.locale, "en");
  assert.equal(row.status, "ACTIVE");
});

test("a duplicate signup succeeds without adding a row and keeps the original signup date", async () => {
  await actions.subscribeToNewsletter({ email: "a@example.com", source: "footer" });
  const firstCreated = rows.get("a@example.com")!.createdAt;
  const again = await actions.subscribeToNewsletter({ email: "A@example.com", source: "blog" });
  assert.deepEqual(again, { success: true });
  assert.equal(rows.size, 1);
  assert.equal(rows.get("a@example.com")!.createdAt, firstCreated);
  assert.equal(rows.get("a@example.com")!.source, "blog");
});

test("signing up again reactivates an unsubscribed address", async () => {
  await actions.subscribeToNewsletter({ email: "b@example.com", source: "footer" });
  const id = rows.get("b@example.com")!.id;
  await actions.setSubscriberStatus(id, "UNSUBSCRIBED");
  assert.equal(rows.get("b@example.com")!.status, "UNSUBSCRIBED");
  assert.ok(rows.get("b@example.com")!.unsubscribedAt);

  await actions.subscribeToNewsletter({ email: "b@example.com", source: "footer" });
  assert.equal(rows.get("b@example.com")!.status, "ACTIVE");
  assert.equal(rows.get("b@example.com")!.unsubscribedAt, null);
});

test("a unique-index race (P2002) still answers success", async () => {
  failNextUpsertWith = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
  assert.deepEqual(await actions.subscribeToNewsletter({ email: "c@example.com", source: "footer" }), { success: true });
});

test("a filled honeypot answers success but saves nothing", async () => {
  const result = await actions.subscribeToNewsletter({ email: "bot@example.com", source: "footer", website: "http://spam.example" });
  assert.deepEqual(result, { success: true });
  assert.equal(rows.size, 0);
});

test("rate-limited signups are refused and not saved", async () => {
  allowRateLimit = false;
  assert.deepEqual(await actions.subscribeToNewsletter({ email: "d@example.com", source: "footer" }), { success: false, error: "rate_limited" });
  assert.equal(rows.size, 0);
});

test("invalid input is rejected", async () => {
  for (const bad of [
    { email: "not-an-email", source: "footer" },
    { email: "e@example.com", source: "sidebar" },
    { email: "e@example.com" },
    { email: "e@example.com", source: "footer", path: "https://evil.example/" },
    null,
  ]) {
    assert.deepEqual(await actions.subscribeToNewsletter(bad), { success: false, error: "invalid" }, JSON.stringify(bad));
  }
  assert.equal(rows.size, 0);
});

test("getSubscribers counts active signups per source and filters the list", async () => {
  await actions.subscribeToNewsletter({ email: "f1@example.com", source: "footer" });
  await actions.subscribeToNewsletter({ email: "f2@example.com", source: "footer" });
  await actions.subscribeToNewsletter({ email: "b1@example.com", source: "blog" });
  await actions.setSubscriberStatus(rows.get("f2@example.com")!.id, "UNSUBSCRIBED");

  const all = await actions.getSubscribers();
  assert.equal(all.matching, 3);
  assert.deepEqual(all.counts, { active: 2, unsubscribed: 1, activeBySource: { footer: 1, blog: 1 } });

  const blogOnly = await actions.getSubscribers({ source: "blog" });
  assert.deepEqual(blogOnly.subscribers.map((s) => s.email), ["b1@example.com"]);

  // Unknown filter values are ignored rather than passed to the query.
  assert.equal((await actions.getSubscribers({ source: "nope", status: "nope" })).matching, 3);
});

test("delete removes the row and writes an audit entry", async () => {
  await actions.subscribeToNewsletter({ email: "g@example.com", source: "blog" });
  const id = rows.get("g@example.com")!.id;
  assert.deepEqual(await actions.deleteSubscriber(id), { success: true });
  assert.equal(rows.size, 0);
  assert.equal(auditEntries.at(-1)?.action, "delete");
  assert.equal(auditEntries.at(-1)?.entityLabel, "g@example.com");
});

test("admin actions refuse without USER_MANAGEMENT", async () => {
  await actions.subscribeToNewsletter({ email: "h@example.com", source: "blog" });
  const id = rows.get("h@example.com")!.id;
  permissionDenied = true;
  assert.equal((await actions.deleteSubscriber(id)).success, false);
  assert.equal((await actions.setSubscriberStatus(id, "UNSUBSCRIBED")).success, false);
  assert.equal((await actions.exportSubscribersCsv()).success, false);
  await assert.rejects(actions.getSubscribers());
  assert.equal(rows.get("h@example.com")!.status, "ACTIVE");
});

test("CSV export neutralizes cells a spreadsheet would run as a formula", () => {
  const csv = subscribersToCsv([
    { email: "+cmd@example.com", source: "footer", status: "ACTIVE", path: "/en", locale: "en", createdAt: new Date("2026-11-01T00:00:00Z"), unsubscribedAt: null },
    { email: "ok@example.com", source: "blog", status: "UNSUBSCRIBED", path: null, locale: null, createdAt: new Date("2026-11-02T00:00:00Z"), unsubscribedAt: new Date("2026-11-03T00:00:00Z") },
  ]);
  const lines = csv.split("\n");
  assert.equal(lines[0], "email,source,status,page,locale,subscribed_at,unsubscribed_at");
  assert.equal(lines[1], "'+cmd@example.com,footer,ACTIVE,/en,en,2026-11-01T00:00:00.000Z,");
  assert.equal(lines[2], "ok@example.com,blog,UNSUBSCRIBED,,,2026-11-02T00:00:00.000Z,2026-11-03T00:00:00.000Z");
});
