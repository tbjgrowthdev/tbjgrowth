// Run with: npm test
//
// Reports, invoices and private client files: upload validation
// (lib/portal/files.ts), the admin actions (app/(admin)/actions/client-files.ts)
// and the two download routes (/api/portal/files/[id] for clients,
// /api/admin/client-files/[id] for staff). Files live in a fake private R2
// bucket; nothing here has a public URL.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

let db = createFakePrisma(CLIENT_HUB_SCHEMA);
const t = () => db._tables as Record<string, Row[]>;
let role: string | null = "ADMIN";
let clientCtx: { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" } | null = null;
let audits: Array<{ action: string; entityType: string; entityId?: string | null }> = [];
let pushes: Array<{ event: string; clientId: string }> = [];
const clock = new Date("2026-11-23T10:00:00Z");

// ---- fake private R2 bucket ----
type Obj = { bytes: Uint8Array; contentType?: string };
let objects = new Map<string, Obj>();
let putFails = false;
const bucket = {
  async put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
    if (putFails) throw new Error("R2 down");
    objects.set(key, { bytes: new Uint8Array(value instanceof Uint8Array ? value : new Uint8Array(value)), contentType: opts?.httpMetadata?.contentType });
    return {};
  },
  async get(key: string) {
    const o = objects.get(key);
    if (!o) return null;
    return { body: new Blob([o.bytes as BlobPart]).stream(), size: o.bytes.byteLength, httpMetadata: { contentType: o.contentType } };
  },
  async delete(key: string) {
    objects.delete(key);
  },
};

const PUBLISH_SQL = 'UPDATE "Report" SET "publishedAt" = $1 WHERE "id" = $2 AND "publishedAt" IS NULL RETURNING "id", "clientId"';
async function queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
  const sql = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "").replace(/\s+/g, " ").trim();
  if (sql === PUBLISH_SQL) {
    const [at, id] = values as [Date, string];
    const r = t().report.find((x) => x.id === id && x.publishedAt == null);
    if (!r) return [];
    r.publishedAt = at;
    return [{ id: r.id, clientId: r.clientId }];
  }
  throw new Error(`unexpected raw SQL: ${sql}`);
}
const proxy = new Proxy({}, { get: (_t, k) => (k === "$queryRaw" ? queryRaw : (db as Row)[k as string]) });

class AuthError extends Error {}
class ClientAuthError extends Error {}
mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });
mock.module("@opennextjs/cloudflare", { namedExports: { getCloudflareContext: () => ({ env: { CLIENT_FILES: bucket } }) } });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => {
      if (!role) throw new AuthError("Not authenticated");
      return { user: { id: "staff_1", role, sessionId: "s1" } };
    },
    requirePermission: async (p: Permission) => {
      if (!role) throw new AuthError("Not authenticated");
      if (!hasPermission(role as never, p)) throw new AuthError(`Missing required permission: ${p}`);
      return { user: { id: "staff_1", role, sessionId: "s1" } };
    },
  },
});
mock.module("@/lib/portal/auth", {
  namedExports: {
    ClientAuthError,
    requireClient: async () => {
      if (!clientCtx) throw new ClientAuthError("Please sign in again.");
      return clientCtx;
    },
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (p: (typeof audits)[number]) => void audits.push(p) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/push/client-notify", { namedExports: { notifyClients: async (event: string, clientId: string) => void pushes.push({ event, clientId }) } });
mock.module("@/lib/clients/clock", { namedExports: { now: () => new Date(clock) } });

const files = await import("@/lib/portal/files");
const actions = await import("../app/(admin)/actions/client-files");
const portalRoute = await import("../app/api/portal/files/[id]/route");
const adminRoute = await import("../app/api/admin/client-files/[id]/route");
const portal = await import("@/lib/portal/data");

const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const pdfFile = (name = "report.pdf") => new File([PDF as BlobPart], name, { type: "application/pdf" });

function reportForm(over: Record<string, string | File | null> = {}) {
  const fd = new FormData();
  const base: Record<string, string | File | null> = {
    clientId: "client_a",
    period: "2026-10",
    title: "October report",
    summary: "Leads up",
    metrics: JSON.stringify([{ label: "Leads", value: "42", change: "+12%" }]),
    file: pdfFile(),
    ...over,
  };
  for (const [k, v] of Object.entries(base)) if (v !== null) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA);
  role = "ADMIN";
  clientCtx = null;
  audits = [];
  pushes = [];
  objects = new Map();
  putFails = false;
  for (const tag of ["a", "b"]) {
    t().client.push({ id: `client_${tag}`, name: `Client ${tag}` });
    t().clientUser.push({ id: `cu_${tag}`, clientId: `client_${tag}`, email: `${tag}@x.test`, name: tag, status: "ACTIVE", language: "en" });
    t().project.push({ id: `proj_${tag}`, clientId: `client_${tag}`, title: `Project ${tag}`, status: "IN_PROGRESS", progress: 0, createdAt: clock });
  }
});

const ctxFor = (tag: "a" | "b") => ({ clientUserId: `cu_${tag}`, clientId: `client_${tag}`, sessionId: `s_${tag}`, language: "en" as const });
const get = (route: { GET: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response> }, id: string, kind: string) =>
  route.GET(new Request(`https://x.test/files/${id}?kind=${kind}`), { params: Promise.resolve({ id }) });

async function seedReport(clientTag: "a" | "b", published = true) {
  const r = await actions.createReport(reportForm({ clientId: `client_${clientTag}`, publish: published ? "on" : null }));
  assert.equal(r.success, true, JSON.stringify(r));
  return (r as { id: string }).id;
}

// ---- validation ----

test("report metrics accept at most 4 items and reject non-text labels", () => {
  const four = Array.from({ length: 4 }, (_, i) => ({ label: `L${i}`, value: String(i) }));
  assert.deepEqual(files.parseReportMetrics(JSON.stringify(four)), { ok: true, metrics: four });
  assert.equal(files.parseReportMetrics(JSON.stringify([...four, { label: "L5", value: "5" }])).ok, false);
  assert.equal(files.parseReportMetrics(JSON.stringify([{ label: 42, value: "1" }])).ok, false);
  assert.equal(files.parseReportMetrics(JSON.stringify([{ label: "<b>x</b>".repeat(20), value: "1" }])).ok, false);
  assert.equal(files.parseReportMetrics("not json").ok, false);
  assert.deepEqual(files.parseReportMetrics(""), { ok: true, metrics: null });
});

test("rejects non-allowed content types and oversize files", async () => {
  assert.equal((await files.checkUpload(new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }))).ok, false);
  assert.equal((await files.checkUpload(new File(["<html>"], "x.html", { type: "text/html" }))).ok, false);
  // A declared PDF whose bytes aren't a PDF.
  assert.equal((await files.checkUpload(new File(["<script>"], "x.pdf", { type: "application/pdf" }))).ok, false);
  const big = new Uint8Array(files.MAX_FILE_BYTES + 1);
  big.set(PDF);
  assert.equal((await files.checkUpload(new File([big as BlobPart], "big.pdf", { type: "application/pdf" }))).ok, false);
  assert.equal((await files.checkUpload(pdfFile())).ok, true);
  assert.equal((await files.checkUpload(new File([PNG as BlobPart], "a.png", { type: "image/png" }))).ok, true);
  // Through the action: nothing stored.
  const r = await actions.createReport(reportForm({ file: new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }) }));
  assert.equal(r.success, false);
  assert.equal(objects.size, 0);
  assert.equal(t().report.length, 0);
});

// ---- reports ----

test("a report file is stored under clients/{clientId}/ and only its key is recorded", async () => {
  const id = await seedReport("a");
  const row = t().report.find((r) => r.id === id)!;
  assert.match(row.fileKey, /^clients\/client_a\/[0-9a-f-]{36}$/);
  assert.ok(objects.has(row.fileKey));
  assert.deepEqual(row.metrics, [{ label: "Leads", value: "42", change: "+12%" }]);
});

test("a report can't link another client's project", async () => {
  const r = await actions.createReport(reportForm({ projectId: "proj_b" }));
  assert.equal(r.success, false);
  assert.equal(objects.size, 0);
  // Even a mismatched row (written before this check) never shows the other client's project.
  t().report.push({ id: "rep_bad", clientId: "client_a", projectId: "proj_b", period: "2026-09", title: "x", summary: null, metrics: null, fileKey: "clients/client_a/k", publishedAt: clock, createdAt: clock });
  const shown = await portal.getReport(ctxFor("a"), "rep_bad");
  assert.equal(shown?.project, null);
});

test("draft (unpublished) reports are not visible to the client", async () => {
  const id = await seedReport("a", false);
  assert.equal((await portal.listReports(ctxFor("a"))).length, 0);
  clientCtx = ctxFor("a");
  assert.equal((await get(portalRoute, id, "report")).status, 404);
});

test("publishing notifies the client once", async () => {
  const id = await seedReport("a", false);
  assert.equal((await actions.setReportPublished(id, true)).success, true);
  assert.equal((await actions.setReportPublished(id, true)).success, true);
  assert.deepEqual(pushes, [{ event: "CLIENT_REPORT_READY", clientId: "client_a" }]);
  assert.equal((await portal.listReports(ctxFor("a"))).length, 1);
});

test("EDITOR can add reports; only CLIENT_MANAGEMENT can delete them or touch invoices", async () => {
  role = "EDITOR";
  const id = await seedReport("a");
  assert.equal((await actions.deleteReport(id)).success, false);
  assert.equal((await actions.createInvoice(invoiceForm())).success, false);
  role = "CONTRIBUTOR";
  assert.equal((await actions.createReport(reportForm())).success, false);
});

test("deleting a report removes its row and its file", async () => {
  const id = await seedReport("a");
  const key = t().report[0].fileKey;
  assert.equal((await actions.deleteReport(id)).success, true);
  assert.equal(t().report.length, 0);
  assert.equal(objects.has(key), false);
});

test("if storage fails nothing is recorded", async () => {
  putFails = true;
  assert.equal((await actions.createReport(reportForm())).success, false);
  assert.equal(t().report.length, 0);
});

// ---- invoices ----

function invoiceForm(over: Record<string, string | File | null> = {}) {
  const fd = new FormData();
  const base: Record<string, string | File | null> = { clientId: "client_a", number: "INV-001", amount: "15000.50", currency: "BDT", issueDate: "2026-11-20", dueDate: "2026-12-05", file: pdfFile("inv.pdf"), ...over };
  for (const [k, v] of Object.entries(base)) if (v !== null) fd.set(k, v);
  return fd;
}

test("an invoice stores money as integer minor units with its currency, and notifies the client", async () => {
  const r = await actions.createInvoice(invoiceForm());
  assert.equal(r.success, true);
  const inv = t().invoice[0];
  assert.equal(inv.amountMinor, 1500050);
  assert.equal(inv.currency, "BDT");
  assert.equal(inv.status, "DUE");
  assert.match(inv.fileKey, /^clients\/client_a\//);
  assert.deepEqual(pushes, [{ event: "CLIENT_INVOICE_DUE", clientId: "client_a" }]);
});

test("invoice amounts and currencies are validated", async () => {
  const bad: Array<Record<string, string>> = [{ amount: "-5" }, { amount: "12.345" }, { amount: "abc" }, { currency: "USD" }, { dueDate: "2026-11-01" }];
  for (const over of bad) {
    assert.equal((await actions.createInvoice(invoiceForm(over))).success, false, JSON.stringify(over));
  }
  assert.equal(t().invoice.length, 0);
  // The file is optional.
  assert.equal((await actions.createInvoice(invoiceForm({ file: null }))).success, true);
});

test("invoice status can be changed and is audit-logged", async () => {
  await actions.createInvoice(invoiceForm());
  const id = t().invoice[0].id;
  assert.equal((await actions.setInvoiceStatus(id, "PAID")).success, true);
  assert.equal(t().invoice[0].status, "PAID");
  assert.equal((await actions.setInvoiceStatus(id, "BOGUS" as never)).success, false);
  assert.ok(audits.some((a) => a.action === "status" && a.entityType === "Invoice"));
});

// ---- downloads ----

test("no session gets 401", async () => {
  const id = await seedReport("a");
  clientCtx = null;
  assert.equal((await get(portalRoute, id, "report")).status, 401);
  role = null;
  assert.equal((await get(adminRoute, id, "report")).status, 401);
});

test("client A cannot download client B's file (404, not 403)", async () => {
  const idB = await seedReport("b");
  await actions.createInvoice(invoiceForm({ clientId: "client_b" }));
  clientCtx = ctxFor("a");
  assert.equal((await get(portalRoute, idB, "report")).status, 404);
  assert.equal((await get(portalRoute, t().invoice[0].id, "invoice")).status, 404);
});

test("a client downloads their own file privately, as an attachment", async () => {
  const id = await seedReport("a");
  clientCtx = ctxFor("a");
  const res = await get(portalRoute, id, "report");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.match(res.headers.get("content-disposition") ?? "", /^attachment; filename="report-2026-10\.pdf"/);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PDF);
});

test("a file key outside the client's own folder is never served, even if the row says so", async () => {
  t().report.push({ id: "rep_x", clientId: "client_a", projectId: null, period: "2026-09", title: "x", summary: null, metrics: null, fileKey: "clients/client_b/secret", publishedAt: clock, createdAt: clock });
  objects.set("clients/client_b/secret", { bytes: PDF, contentType: "application/pdf" });
  clientCtx = ctxFor("a");
  assert.equal((await get(portalRoute, "rep_x", "report")).status, 404);
});

test("an unknown kind is a 404", async () => {
  clientCtx = ctxFor("a");
  assert.equal((await get(portalRoute, "anything", "user")).status, 404);
});

test("staff without CLIENT_MANAGEMENT cannot download", async () => {
  const id = await seedReport("a");
  for (const r of ["EDITOR", "SEO_MANAGER", "CONTRIBUTOR"]) {
    role = r;
    assert.equal((await get(adminRoute, id, "report")).status, 403, r);
  }
  role = "ADMIN";
  const res = await get(adminRoute, id, "report");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  // Staff can open drafts too.
  const draft = await seedReport("a", false);
  assert.equal((await get(adminRoute, draft, "report")).status, 200);
});

// ---- update attachments (quick-post) ----

test("an update attachment is stored privately and shows in the portal by name only", async () => {
  t().projectUpdate.push({ id: "upd_a", projectId: "proj_a", authorId: "staff_1", kind: "MANUAL", body: "Logo files", internalNote: null, createdAt: clock });
  role = "EDITOR";
  const fd = new FormData();
  fd.set("updateId", "upd_a");
  fd.set("file", new File([PNG as BlobPart], "logo.png", { type: "image/png" }));
  assert.equal((await actions.attachFileToUpdate(fd)).success, true);
  const att = t().projectAttachment[0];
  assert.match(att.fileKey, /^clients\/client_a\//);
  const project = await portal.getProject(ctxFor("a"), "proj_a");
  assert.equal(JSON.stringify(project).includes(att.fileKey), false);
  clientCtx = ctxFor("a");
  const res = await get(portalRoute, att.id, "attachment");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  clientCtx = ctxFor("b");
  assert.equal((await get(portalRoute, att.id, "attachment")).status, 404);
});
