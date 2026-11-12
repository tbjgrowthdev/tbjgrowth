// Run with: npm test
//
// Drives lib/retention.ts against a fake Prisma client that records every
// call, so the rules can be checked without a database.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Call = { model: string; op: string; args: unknown };
let calls: Call[] = [];
let failModel: string | null = null;
let newestExists = true;

function delegate(model: string) {
  return {
    async count(args: unknown) {
      calls.push({ model, op: "count", args });
      if (failModel === model) throw new Error(`${model} is down`);
      return 3;
    },
    async deleteMany(args: unknown) {
      calls.push({ model, op: "deleteMany", args });
      if (failModel === model) throw new Error(`${model} is down`);
      return { count: 2 };
    },
    async findFirst(args: unknown) {
      calls.push({ model, op: "findFirst", args });
      return newestExists ? { id: `${model}-newest` } : null;
    },
  };
}

const MODELS = [
  "slowQueryLog", "webVitalSample", "uptimeCheck", "errorLog", "emailLog", "loginAttempt", "notFoundLog",
  "adminSession", "linkCheckRun", "seoAuditRun", "backupRun", "automationRun", "scheduledJob",
];
const fakePrisma = Object.fromEntries(MODELS.map((m) => [m, delegate(m)]));
mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });

let runRetention: typeof import("../lib/retention").runRetention;
before(async () => {
  ({ runRetention } = await import("../lib/retention"));
});
beforeEach(() => {
  calls = [];
  failModel = null;
  newestExists = true;
});

const NOW = new Date("2026-11-12T00:00:00.000Z");
const daysBefore = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const whereOf = (model: string, op = "deleteMany") =>
  (calls.find((c) => c.model === model && c.op === op)?.args as { where: Record<string, unknown> }).where;

test("each table gets its agreed cutoff", async () => {
  await runRetention({ now: NOW });
  assert.deepEqual(whereOf("slowQueryLog"), { createdAt: { lt: daysBefore(30) } });
  assert.deepEqual(whereOf("webVitalSample"), { createdAt: { lt: daysBefore(30) } });
  assert.deepEqual(whereOf("errorLog"), { createdAt: { lt: daysBefore(90) } });
  assert.deepEqual(whereOf("emailLog"), { createdAt: { lt: daysBefore(90) } });
  assert.deepEqual(whereOf("loginAttempt"), { createdAt: { lt: daysBefore(180) } });
  assert.deepEqual(whereOf("notFoundLog"), { updatedAt: { lt: daysBefore(90) } });
  assert.deepEqual(whereOf("backupRun"), { startedAt: { lt: daysBefore(365) } });
  assert.deepEqual(whereOf("adminSession"), { OR: [{ revokedAt: { lt: daysBefore(30) } }, { lastSeenAt: { lt: daysBefore(60) } }] });
});

test("the newest uptime check, link check and SEO audit are always kept", async () => {
  await runRetention({ now: NOW });
  assert.deepEqual(whereOf("uptimeCheck"), { checkedAt: { lt: daysBefore(30) }, id: { not: "uptimeCheck-newest" } });
  assert.deepEqual(whereOf("linkCheckRun"), { startedAt: { lt: daysBefore(90) }, id: { not: "linkCheckRun-newest" } });
  assert.deepEqual(whereOf("seoAuditRun"), { startedAt: { lt: daysBefore(90) }, id: { not: "seoAuditRun-newest" } });
});

test("an empty table with a keep-newest rule deletes nothing", async () => {
  newestExists = false;
  const results = await runRetention({ now: NOW });
  assert.equal(calls.some((c) => c.model === "uptimeCheck" && c.op === "deleteMany"), false);
  assert.deepEqual(results.find((r) => r.table === "UptimeCheck"), { table: "UptimeCheck", rule: "older than 30 days, except the newest check", rows: 0 });
});

test("unfinished automation runs and scheduled jobs are never deleted", async () => {
  await runRetention({ now: NOW });
  assert.deepEqual(whereOf("automationRun"), { status: { in: ["SUCCEEDED", "FAILED", "REJECTED"] }, completedAt: { lt: daysBefore(180) } });
  assert.deepEqual(whereOf("scheduledJob"), { status: { in: ["COMPLETED", "FAILED", "CANCELLED"] }, updatedAt: { lt: daysBefore(180) } });
});

test("dry run only counts, never deletes", async () => {
  const results = await runRetention({ now: NOW, dryRun: true });
  assert.equal(calls.some((c) => c.op === "deleteMany"), false);
  assert.equal(results.length, 13);
  assert.ok(results.every((r) => "rows" in r && r.rows === 3));
});

test("one failing table doesn't stop the others", async () => {
  failModel = "errorLog";
  const results = await runRetention({ now: NOW });
  assert.deepEqual(results.find((r) => r.table === "ErrorLog"), { table: "ErrorLog", rule: "older than 90 days", error: "errorLog is down" });
  assert.equal(results.filter((r) => "rows" in r).length, 12);
  assert.ok(calls.some((c) => c.model === "scheduledJob" && c.op === "deleteMany"));
});
