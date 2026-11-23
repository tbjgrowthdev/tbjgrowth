// Run with: npm test
//
// A client answering an approval request: app/(portal)/actions/approvals.ts
// over lib/portal/data.ts respondToApproval, against the shared fake database.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";

let db = createFakePrisma(CLIENT_HUB_SCHEMA);
const proxy = new Proxy({}, { get: (_t, k) => (db as Row)[k as string] });
const t = () => db._tables as Record<string, Row[]>;
const NOW = new Date("2026-11-23T10:00:00Z");

class ClientAuthError extends Error {}
let ctx: { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" } | null = null;
let audits: Array<{ action: string; category: string; entityType: string; entityId?: string | null; actor?: { name: string | null; email: string | null } }> = [];
let pushes: string[] = [];

mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });
mock.module("@/lib/portal/auth", {
  namedExports: {
    ClientAuthError,
    requireClient: async () => {
      if (!ctx) throw new ClientAuthError("Please sign in again.");
      return ctx;
    },
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (p: (typeof audits)[number]) => void audits.push(p) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/push/client-notify", { namedExports: { notifyClients: async (event: string) => void pushes.push(event) } });
mock.module("@/lib/clients/clock", { namedExports: { now: () => new Date(NOW) } });

const { respondToApproval } = await import("../app/(portal)/actions/approvals");

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA);
  audits = [];
  pushes = [];
  for (const tag of ["a", "b"]) {
    t().client.push({ id: `client_${tag}`, name: `Client ${tag}` });
    t().clientUser.push({ id: `cu_${tag}`, clientId: `client_${tag}`, email: `${tag}@x.test`, name: `User ${tag}`, status: "ACTIVE", language: "en" });
    t().project.push({ id: `proj_${tag}`, clientId: `client_${tag}`, title: `Project ${tag}`, status: "WAITING_ON_CLIENT", progress: 50, createdAt: NOW, lastClientNotifyAt: null });
    t().approvalRequest.push({ id: `appr_${tag}`, projectId: `proj_${tag}`, title: `Homepage ${tag}`, description: null, status: "PENDING", response: null, respondedById: null, respondedAt: null, createdAt: NOW });
  }
  ctx = { clientUserId: "cu_a", clientId: "client_a", sessionId: "s_a", language: "en" };
});

const approval = (id: string) => t().approvalRequest.find((a) => a.id === id)!;

test("approve sets APPROVED, stamps respondedBy and time", async () => {
  const r = await respondToApproval({ approvalId: "appr_a", decision: "APPROVED" });
  assert.equal(r.success, true);
  const a = approval("appr_a");
  assert.equal(a.status, "APPROVED");
  assert.equal(a.respondedById, "cu_a");
  assert.equal(new Date(a.respondedAt).getTime(), NOW.getTime());
});

test("cannot respond twice", async () => {
  assert.equal((await respondToApproval({ approvalId: "appr_a", decision: "APPROVED" })).success, true);
  const second = await respondToApproval({ approvalId: "appr_a", decision: "CHANGES_REQUESTED", comment: "Wait" });
  assert.equal(second.success, false);
  assert.equal(approval("appr_a").status, "APPROVED");
});

test("two answers at the same moment: only one wins", async () => {
  const results = await Promise.all([
    respondToApproval({ approvalId: "appr_a", decision: "APPROVED" }),
    respondToApproval({ approvalId: "appr_a", decision: "CHANGES_REQUESTED", comment: "No" }),
  ]);
  assert.equal(results.filter((r) => r.success).length, 1);
  assert.equal(t().projectUpdate.filter((u) => u.kind === "APPROVAL").length, 1);
});

test("request changes requires a comment", async () => {
  for (const comment of [undefined, "", "   "]) {
    assert.equal((await respondToApproval({ approvalId: "appr_a", decision: "CHANGES_REQUESTED", comment })).success, false);
  }
  assert.equal(approval("appr_a").status, "PENDING");
  const ok = await respondToApproval({ approvalId: "appr_a", decision: "CHANGES_REQUESTED", comment: "  Bigger logo please " });
  assert.equal(ok.success, true);
  assert.equal(approval("appr_a").response, "Bigger logo please");
});

test("any other decision is rejected at runtime", async () => {
  for (const decision of ["PENDING", "approved", "DELETE", 1, null]) {
    assert.equal((await respondToApproval({ approvalId: "appr_a", decision: decision as never })).success, false, String(decision));
  }
  assert.equal(approval("appr_a").status, "PENDING");
});

test("responding is scoped to the session client", async () => {
  const r = await respondToApproval({ approvalId: "appr_b", decision: "APPROVED" });
  assert.equal(r.success, false);
  assert.equal(approval("appr_b").status, "PENDING");
  assert.equal(t().project.find((p) => p.id === "proj_b")!.status, "WAITING_ON_CLIENT");
});

test("no session: refused", async () => {
  ctx = null;
  assert.equal((await respondToApproval({ approvalId: "appr_a", decision: "APPROVED" })).success, false);
  assert.equal(approval("appr_a").status, "PENDING");
});

test("audit log entry is written, naming the client user (not a staff session)", async () => {
  await respondToApproval({ approvalId: "appr_a", decision: "APPROVED" });
  assert.equal(audits.length, 1);
  assert.deepEqual([audits[0].action, audits[0].category, audits[0].entityType, audits[0].entityId], ["approve", "Approval", "ApprovalRequest", "appr_a"]);
  assert.deepEqual(audits[0].actor, { name: "User a (client)", email: "a@x.test" });
});

test("the answer goes into the project feed and the project returns to IN_PROGRESS once nothing is pending", async () => {
  t().approvalRequest.push({ id: "appr_a2", projectId: "proj_a", title: "Logo", description: null, status: "PENDING", response: null, respondedById: null, respondedAt: null, createdAt: NOW });
  await respondToApproval({ approvalId: "appr_a", decision: "CHANGES_REQUESTED", comment: "Bigger" });
  assert.equal(t().project.find((p) => p.id === "proj_a")!.status, "WAITING_ON_CLIENT"); // one still pending
  await respondToApproval({ approvalId: "appr_a2", decision: "APPROVED" });
  assert.equal(t().project.find((p) => p.id === "proj_a")!.status, "IN_PROGRESS");
  const feed = t().projectUpdate.filter((u) => u.kind === "APPROVAL").map((u) => u.body);
  assert.deepEqual(feed, ["Changes requested: Homepage a", "Approved: Logo"]);
  // The client did it themselves: no push to the client.
  assert.deepEqual(pushes, []);
});
