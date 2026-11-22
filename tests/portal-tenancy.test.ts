// Run with: npm test
//
// The portal data layer (lib/portal/data.ts) against two clients, alpha and
// bravo, with one of everything each. Every function runs as alpha and must
// never return, count or change anything of bravo's, and never return a
// staff-only field (Client.notes, ProjectUpdate.internalNote) or a raw R2
// file key. Every bravo value contains "bravo" and every staff-only value a
// STAFF marker, so one JSON scan per result catches any leak.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";

let db = createFakePrisma(CLIENT_HUB_SCHEMA);
const proxy = new Proxy({}, { get: (_t, k) => (db as Row)[k as string] });
mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });

const data = await import("@/lib/portal/data");

const NOW = new Date("2026-11-22T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

type Ctx = { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" };
const alpha: Ctx = { clientUserId: "cu_alpha", clientId: "client_alpha", sessionId: "sess_alpha", language: "en" };

async function seedClient(tag: "alpha" | "bravo") {
  const t = db._tables as Record<string, Row[]>;
  t.client.push({ id: `client_${tag}`, name: `${tag} Ltd`, accountManagerId: "staff_1", whatsapp: "+8801700000000", phone: "+8801700000001", notes: `STAFF-NOTE ${tag}`, createdAt: NOW });
  t.clientUser.push({ id: `cu_${tag}`, clientId: `client_${tag}`, email: `${tag}@x.test`, name: `${tag} owner`, language: "en", status: "ACTIVE", lastLoginAt: null, deletionRequestedAt: null, createdAt: NOW });
  t.project.push({ id: `proj_${tag}`, clientId: `client_${tag}`, title: `${tag} website`, description: `${tag} desc`, status: "IN_PROGRESS", progress: 40, startDate: at(-30), dueDate: at(30), updateIntervalDays: null, lastUpdateNudgeAt: null, createdAt: at(-30) });
  t.projectMilestone.push({ id: `ms_${tag}`, projectId: `proj_${tag}`, title: `${tag} milestone`, dueDate: at(5), doneAt: null, order: 0 });
  t.projectUpdate.push({ id: `upd_${tag}`, projectId: `proj_${tag}`, authorId: "staff_1", kind: "MANUAL", body: `${tag} update body`, internalNote: `STAFF-INTERNAL ${tag}`, createdAt: at(-1) });
  t.projectAttachment.push({ id: `att_${tag}`, updateId: `upd_${tag}`, name: `${tag}.pdf`, fileKey: `STAFF-FILEKEY clients/${tag}/att` });
  t.approvalRequest.push({ id: `appr_${tag}`, projectId: `proj_${tag}`, title: `${tag} homepage design`, description: null, status: "PENDING", response: null, respondedById: null, respondedAt: null, createdAt: at(-2) });
  t.report.push({ id: `rep_${tag}`, clientId: `client_${tag}`, projectId: `proj_${tag}`, period: "2026-10", title: `${tag} October`, summary: `${tag} summary`, metrics: [{ label: "Leads", value: "12" }], fileKey: `STAFF-FILEKEY clients/${tag}/rep`, publishedAt: at(-3), createdAt: at(-3) });
  t.report.push({ id: `rep_draft_${tag}`, clientId: `client_${tag}`, projectId: null, period: "2026-11", title: `${tag} November draft`, summary: null, metrics: null, fileKey: `STAFF-FILEKEY clients/${tag}/draft`, publishedAt: null, createdAt: at(-1) });
  t.invoice.push({ id: `inv_${tag}`, clientId: `client_${tag}`, number: `INV-${tag}`, amountMinor: 1500000, currency: "BDT", status: "DUE", issueDate: at(-5), dueDate: at(10), fileKey: `STAFF-FILEKEY clients/${tag}/inv`, overdueNotifiedAt: null, createdAt: at(-5) });
  t.invoice.push({ id: `inv_void_${tag}`, clientId: `client_${tag}`, number: `INV-VOID-${tag}`, amountMinor: 100, currency: "GBP", status: "VOID", issueDate: at(-5), dueDate: at(10), fileKey: null, overdueNotifiedAt: null, createdAt: at(-5) });
  t.clientRequest.push({ id: `req_${tag}`, clientUserId: `cu_${tag}`, clientId: `client_${tag}`, message: `${tag} please call`, status: "OPEN", createdAt: at(-1) });
  t.availableSlot.push({ id: `slot_${tag}`, startsAt: at(2), duration: 30, isBooked: true });
  t.booking.push({ id: `book_${tag}`, slotId: `slot_${tag}`, name: `${tag} owner`, email: `${tag}@x.test`, phone: null, company: null, message: `${tag} booking note`, status: "CONFIRMED", clientUserId: `cu_${tag}`, createdAt: NOW, updatedAt: NOW });
}

beforeEach(async () => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA);
  (db._tables as Record<string, Row[]>).user.push({ id: "staff_1", name: "Asif Manager", email: "staff@tbj.test", role: "ADMIN", password: "STAFF-HASH" });
  await seedClient("alpha");
  await seedClient("bravo");
});

function assertNoLeak(label: string, value: unknown) {
  const json = JSON.stringify(value ?? null);
  assert.ok(!json.includes("bravo"), `${label} leaked client bravo's data: ${json}`);
  assert.ok(!json.includes("STAFF"), `${label} leaked a staff-only field: ${json}`);
}

test("tenancy: projects are scoped to the session client", async () => {
  const list = await data.listProjects(alpha);
  assertNoLeak("listProjects", list);
  assert.deepEqual(list.map((p: Row) => p.id), ["proj_alpha"]);
});

test("tenancy: project detail is scoped to the session client", async () => {
  const own = await data.getProject(alpha, "proj_alpha");
  assertNoLeak("getProject", own);
  assert.equal(own?.id, "proj_alpha");
  assert.deepEqual(own?.milestones.map((m: Row) => m.id), ["ms_alpha"]);
  assert.deepEqual(own?.updates.map((u: Row) => u.id), ["upd_alpha"]);
  assert.deepEqual(own?.updates[0].attachments, [{ id: "att_alpha", name: "alpha.pdf" }]);
  assert.equal(own?.updates[0].authorName, "Asif Manager");
  assert.deepEqual(own?.approvals.map((a: Row) => a.id), ["appr_alpha"]);
  assert.equal(await data.getProject(alpha, "proj_bravo"), null);
});

test("tenancy: updates are scoped to the session client", async () => {
  const list = await data.listRecentUpdates(alpha, 10);
  assertNoLeak("listRecentUpdates", list);
  assert.deepEqual(list.map((u: Row) => u.id), ["upd_alpha"]);
  assert.equal(list[0].projectTitle, "alpha website");
});

test("tenancy: milestones are scoped to the session client", async () => {
  const own = await data.listMilestones(alpha, "proj_alpha");
  assertNoLeak("listMilestones", own);
  assert.deepEqual(own.map((m: Row) => m.id), ["ms_alpha"]);
  assert.deepEqual(await data.listMilestones(alpha, "proj_bravo"), []);
});

test("tenancy: approvals are scoped to the session client", async () => {
  const pending = await data.listApprovals(alpha, { status: "PENDING" });
  assertNoLeak("listApprovals", pending);
  assert.deepEqual(pending.map((a: Row) => a.id), ["appr_alpha"]);
  assert.equal(pending[0].projectTitle, "alpha website");
});

test("tenancy: A cannot respond to B's approval", async () => {
  const r = await data.respondToApproval(alpha, "appr_bravo", { decision: "APPROVED" }, NOW);
  assert.deepEqual(r, { ok: false, reason: "not_found" });
  const b = (db._tables as Record<string, Row[]>).approvalRequest.find((x) => x.id === "appr_bravo")!;
  assert.equal(b.status, "PENDING");
  assert.equal(b.respondedById, null);
});

test("respondToApproval answers the client's own pending approval once", async () => {
  const r = await data.respondToApproval(alpha, "appr_alpha", { decision: "CHANGES_REQUESTED", comment: "Bigger logo" }, NOW);
  assert.equal(r.ok, true);
  const a = (db._tables as Record<string, Row[]>).approvalRequest.find((x) => x.id === "appr_alpha")!;
  assert.equal(a.status, "CHANGES_REQUESTED");
  assert.equal(a.response, "Bigger logo");
  assert.equal(a.respondedById, "cu_alpha");
  assert.deepEqual(await data.respondToApproval(alpha, "appr_alpha", { decision: "APPROVED" }, NOW), { ok: false, reason: "already_answered" });
});

test("tenancy: reports are scoped to the session client and drafts stay hidden", async () => {
  const list = await data.listReports(alpha);
  assertNoLeak("listReports", list);
  assert.deepEqual(list.map((r: Row) => r.id), ["rep_alpha"]);
  assert.equal(list[0].hasFile, true);
  assertNoLeak("getReport", await data.getReport(alpha, "rep_alpha"));
  assert.equal(await data.getReport(alpha, "rep_bravo"), null);
  assert.equal(await data.getReport(alpha, "rep_draft_alpha"), null);
});

test("tenancy: invoices are scoped to the session client, void ones hidden", async () => {
  const list = await data.listInvoices(alpha);
  assertNoLeak("listInvoices", list);
  assert.deepEqual(list.map((i: Row) => i.id), ["inv_alpha"]);
  assert.equal(list[0].amountMinor, 1500000);
  assert.equal(list[0].hasFile, true);
});

test("tenancy: requests are scoped to the session client", async () => {
  const list = await data.listRequests(alpha);
  assertNoLeak("listRequests", list);
  assert.deepEqual(list.map((r: Row) => r.id), ["req_alpha"]);
});

test("tenancy: createClientRequest writes for the session client only", async () => {
  const r = await data.createClientRequest(alpha, "  Please add a blog page  ");
  assert.equal(r.ok, true);
  const row = (db._tables as Record<string, Row[]>).clientRequest.find((x) => x.message === "Please add a blog page")!;
  assert.equal(row.clientId, "client_alpha");
  assert.equal(row.clientUserId, "cu_alpha");
  assert.deepEqual(await data.createClientRequest(alpha, "   "), { ok: false, reason: "empty" });
});

test("tenancy: meetings are scoped to the session client", async () => {
  const list = await data.listMeetings(alpha, NOW);
  assertNoLeak("listMeetings", list);
  assert.deepEqual(list.map((m: Row) => m.id), ["book_alpha"]);
  assert.equal(list[0].startsAt.getTime(), at(2).getTime());
});

test("tenancy: profile is the session user's and hides staff notes", async () => {
  const p = await data.getProfile(alpha);
  assertNoLeak("getProfile", p);
  assert.equal(p?.email, "alpha@x.test");
  assert.equal(p?.clientName, "alpha Ltd");
  assert.equal(p?.accountManagerName, "Asif Manager");
  assert.equal(p?.whatsapp, "+8801700000000");
});

test("tenancy: A cannot fetch B's file key", async () => {
  for (const [kind, id] of [["attachment", "att_bravo"], ["report", "rep_bravo"], ["invoice", "inv_bravo"], ["report", "rep_draft_alpha"]] as const) {
    assert.equal(await data.getClientFile(alpha, kind, id), null, `${kind} ${id}`);
  }
  assert.deepEqual(await data.getClientFile(alpha, "attachment", "att_alpha"), { fileKey: "STAFF-FILEKEY clients/alpha/att", name: "alpha.pdf" });
  assert.equal((await data.getClientFile(alpha, "report", "rep_alpha"))?.fileKey, "STAFF-FILEKEY clients/alpha/rep");
  assert.equal((await data.getClientFile(alpha, "invoice", "inv_alpha"))?.fileKey, "STAFF-FILEKEY clients/alpha/inv");
});

test("no internal field is ever returned by any read", async () => {
  const results = [
    await data.listProjects(alpha),
    await data.getProject(alpha, "proj_alpha"),
    await data.listRecentUpdates(alpha, 10),
    await data.listMilestones(alpha, "proj_alpha"),
    await data.listApprovals(alpha, {}),
    await data.listReports(alpha),
    await data.getReport(alpha, "rep_alpha"),
    await data.listInvoices(alpha),
    await data.listRequests(alpha),
    await data.listMeetings(alpha, NOW),
    await data.getProfile(alpha),
  ];
  for (const r of results) {
    const json = JSON.stringify(r);
    for (const field of ["notes", "internalNote", "fileKey", "password", "accountManagerId", "authorId"]) {
      assert.ok(!json.includes(`"${field}"`), `field ${field} returned: ${json}`);
    }
    assertNoLeak("read", r);
  }
});

test("a context for a client with no data gets empty results, not someone else's", async () => {
  const stranger: Ctx = { clientUserId: "cu_none", clientId: "client_none", sessionId: "s", language: "en" };
  assert.deepEqual(await data.listProjects(stranger), []);
  assert.deepEqual(await data.listInvoices(stranger), []);
  assert.deepEqual(await data.listReports(stranger), []);
  assert.deepEqual(await data.listApprovals(stranger, {}), []);
  assert.deepEqual(await data.listMeetings(stranger, NOW), []);
  assert.equal(await data.getProfile(stranger), null);
});

test("portal pages, actions and components never import Prisma directly", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name) && /@\/lib\/prisma|lib\/generated\/prisma/.test(readFileSync(full, "utf8"))) offenders.push(full);
    }
  };
  for (const dir of ["app/(portal)", "components/Portal"]) walk(dir);
  assert.deepEqual(offenders, [], "use lib/portal/data.ts (tenancy-scoped) instead");
});
