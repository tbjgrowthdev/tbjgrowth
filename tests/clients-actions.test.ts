// Run with: npm test
//
// Admin Clients section (app/(admin)/actions/clients.ts): clients, their
// users, invites, disabling and session revocation. Against the shared
// fake database, a fake mailer, a fake audit log and a fake staff session.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

process.env.CLIENT_SESSION_SECRET = "test-client-secret-0123456789abcdef0123456789";

let db = createFakePrisma(CLIENT_HUB_SCHEMA, { unique: { clientUser: ["email"] } });
const proxy = new Proxy({}, { get: (_t, k) => (db as Row)[k as string] });
let role = "ADMIN";
let invites: Array<{ to: string; code: string; portalUrl: string; language?: string }> = [];
let audits: Array<{ action: string; entityType: string; entityId?: string | null }> = [];
let inviteResult: { success: boolean; skipped?: boolean } = { success: true };

class AuthError extends Error {}

mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => ({ user: { id: "staff_admin", role, sessionId: "s1" } }),
    requirePermission: async (p: Permission) => {
      if (!hasPermission(role as never, p)) throw new AuthError(`Missing required permission: ${p}`);
      return { user: { id: "staff_admin", role, sessionId: "s1" } };
    },
  },
});
mock.module("@/lib/audit-log", {
  namedExports: {
    logAudit: async (p: { action: string; entityType: string; entityId?: string | null }) => void audits.push(p),
  },
});
mock.module("@/lib/email", {
  namedExports: {
    sendClientInvite: async (p: { to: string; code: string; portalUrl: string; language?: string }) => {
      invites.push(p);
      return inviteResult;
    },
    sendClientLoginCode: async () => ({ success: true }),
  },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

const actions = await import("../app/(admin)/actions/clients");

const t = () => db._tables as Record<string, Row[]>;
const NOW = new Date("2026-11-23T10:00:00Z");

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA, { unique: { clientUser: ["email"] } });
  role = "ADMIN";
  invites = [];
  audits = [];
  inviteResult = { success: true };
  t().user.push({ id: "staff_admin", name: "Ana Admin", email: "ana@tbj.test", role: "ADMIN" });
  t().user.push({ id: "staff_editor", name: "Eli Editor", email: "eli@tbj.test", role: "EDITOR" });
  t().client.push({ id: "client_a", name: "Acme", accountManagerId: null, whatsapp: null, phone: null, notes: null, createdAt: NOW });
});

function addUser(id: string, over: Row = {}) {
  t().clientUser.push({ id, clientId: "client_a", email: `${id}@acme.test`, name: id, language: "en", status: "ACTIVE", lastLoginAt: NOW, deletionRequestedAt: null, createdAt: NOW, ...over });
}

// ---- permissions ----

const MUTATIONS: Array<[string, () => Promise<{ success: boolean }>]> = [
  ["createClient", () => actions.createClient({ name: "New Co" })],
  ["updateClient", () => actions.updateClient("client_a", { name: "Acme 2" })],
  ["assignAccountManager", () => actions.assignAccountManager("client_a", "staff_editor")],
  ["addClientUser", () => actions.addClientUser("client_a", { email: "new@acme.test", name: "New", language: "en" })],
  ["resendInvite", async () => (addUser("cu_x", { status: "INVITED", lastLoginAt: null }), actions.resendInvite("cu_x"))],
  ["setClientUserDisabled", async () => (addUser("cu_y"), actions.setClientUserDisabled("cu_y", true))],
  ["revokeClientUserSessions", async () => (addUser("cu_z"), actions.revokeClientUserSessions("cu_z"))],
];

for (const [name, run] of MUTATIONS) {
  for (const r of ["SUPER_ADMIN", "ADMIN"]) {
    test(`${name}: ${r} is allowed`, async () => {
      role = r;
      assert.equal((await run()).success, true);
    });
  }
  for (const r of ["EDITOR", "SEO_MANAGER", "CONTRIBUTOR"]) {
    test(`${name}: ${r} is refused and nothing is written`, async () => {
      role = r;
      const before = JSON.stringify(t());
      const result = await run();
      assert.equal(result.success, false);
      // The setup helpers inside run() may add a row; strip those before comparing.
      const after = JSON.parse(JSON.stringify(t()));
      after.clientUser = after.clientUser.filter((u: Row) => !["cu_x", "cu_y", "cu_z"].includes(u.id));
      assert.deepEqual(after, JSON.parse(before));
      assert.equal(invites.length, 0);
      assert.equal(audits.length, 0);
    });
  }
}

test("EDITOR can list clients (to post updates) but SEO_MANAGER and CONTRIBUTOR get nothing", async () => {
  role = "EDITOR";
  assert.equal((await actions.listClientsForAdmin()).length, 1);
  for (const r of ["SEO_MANAGER", "CONTRIBUTOR"]) {
    role = r;
    assert.deepEqual(await actions.listClientsForAdmin(), []);
    assert.equal(await actions.getClientForAdmin("client_a"), null);
  }
});

// ---- clients ----

test("createClient stores the client and writes an audit entry", async () => {
  const result = await actions.createClient({ name: "  Bravo Ltd ", whatsapp: "+8801711111111", notes: "pays late" });
  assert.equal(result.success, true);
  const row = t().client.find((c) => c.name === "Bravo Ltd")!;
  assert.equal(row.whatsapp, "+8801711111111");
  assert.equal(row.notes, "pays late");
  assert.deepEqual(audits.map((a) => [a.action, a.entityType, a.entityId]), [["create", "Client", row.id]]);
});

test("createClient rejects an empty name", async () => {
  assert.equal((await actions.createClient({ name: "   " })).success, false);
  assert.equal(t().client.length, 1);
});

test("assignAccountManager accepts a staff user and rejects anyone else", async () => {
  assert.equal((await actions.assignAccountManager("client_a", "staff_editor")).success, true);
  assert.equal(t().client[0].accountManagerId, "staff_editor");
  assert.equal((await actions.assignAccountManager("client_a", "nobody")).success, false);
  assert.equal(t().client[0].accountManagerId, "staff_editor");
  assert.equal((await actions.assignAccountManager("client_a", null)).success, true);
  assert.equal(t().client[0].accountManagerId, null);
  assert.equal(audits.length, 2);
});

test("getClientForAdmin includes staff notes and users (staff view)", async () => {
  t().client[0].notes = "internal";
  addUser("cu_1");
  const c = await actions.getClientForAdmin("client_a");
  assert.equal(c?.notes, "internal");
  assert.equal(c?.users.length, 1);
});

// ---- users and invites ----

test("addClientUser creates an INVITED user and sends exactly one invite email with a code", async () => {
  const result = await actions.addClientUser("client_a", { email: "  Owner@Acme.TEST ", name: "Owner", language: "bn" });
  assert.equal(result.success, true);
  const u = t().clientUser.find((x) => x.email === "owner@acme.test")!;
  assert.equal(u.status, "INVITED");
  assert.equal(u.clientId, "client_a");
  assert.equal(invites.length, 1);
  assert.equal(invites[0].to, "owner@acme.test");
  assert.match(invites[0].code, /^\d{6}$/);
  assert.match(invites[0].portalUrl, /\/portal\/login\?lang=bn$/);
  assert.equal(invites[0].language, "bn");
  // Only a hash of the code is stored.
  assert.equal(t().clientLoginCode.length, 1);
  assert.notEqual(t().clientLoginCode[0].codeHash, invites[0].code);
  assert.deepEqual(audits.map((a) => [a.action, a.entityType]), [["invite", "ClientUser"]]);
});

test("addClientUser rejects an email that already has an account, without sending", async () => {
  addUser("cu_1", { email: "taken@acme.test" });
  const result = await actions.addClientUser("client_a", { email: "TAKEN@acme.test", name: "Dup", language: "en" });
  assert.equal(result.success, false);
  assert.equal(invites.length, 0);
  assert.equal(t().clientUser.length, 1);
});

test("addClientUser rejects an invalid email and an unknown client", async () => {
  assert.equal((await actions.addClientUser("client_a", { email: "not-an-email", name: "X", language: "en" })).success, false);
  assert.equal((await actions.addClientUser("client_nope", { email: "x@acme.test", name: "X", language: "en" })).success, false);
  assert.equal(invites.length, 0);
  assert.equal(t().clientUser.length, 0);
});

test("resendInvite sends one new code; a disabled user gets none", async () => {
  addUser("cu_1", { status: "INVITED", lastLoginAt: null });
  assert.equal((await actions.resendInvite("cu_1")).success, true);
  assert.equal(invites.length, 1);
  addUser("cu_2", { status: "DISABLED" });
  assert.equal((await actions.resendInvite("cu_2")).success, false);
  assert.equal(invites.length, 1);
});

test("resendInvite stops after the hourly code limit for that email", async () => {
  addUser("cu_1", { status: "INVITED", lastLoginAt: null });
  const results = [];
  for (let i = 0; i < 7; i++) results.push((await actions.resendInvite("cu_1")).success);
  assert.deepEqual(results, [true, true, true, true, true, false, false]);
  assert.equal(invites.length, 5);
});

test("disabling a user revokes their sessions and deletes their push devices, and no one else's", async () => {
  addUser("cu_1");
  addUser("cu_2");
  t().clientSession.push({ id: "s_1a", clientUserId: "cu_1", revokedAt: null, createdAt: NOW, lastSeenAt: NOW });
  t().clientSession.push({ id: "s_1b", clientUserId: "cu_1", revokedAt: null, createdAt: NOW, lastSeenAt: NOW });
  t().clientSession.push({ id: "s_2", clientUserId: "cu_2", revokedAt: null, createdAt: NOW, lastSeenAt: NOW });
  t().pushDevice.push({ id: "d_1", userId: null, clientUserId: "cu_1", adminSessionId: null, platform: "android", token: "tok1" });
  t().pushDevice.push({ id: "d_2", userId: null, clientUserId: "cu_2", adminSessionId: null, platform: "android", token: "tok2" });
  t().pushDevice.push({ id: "d_staff", userId: "staff_admin", clientUserId: null, adminSessionId: "s1", platform: "android", token: "tok3" });

  assert.equal((await actions.setClientUserDisabled("cu_1", true)).success, true);
  assert.equal(t().clientUser.find((u) => u.id === "cu_1")!.status, "DISABLED");
  assert.ok(t().clientSession.filter((s) => s.clientUserId === "cu_1").every((s) => s.revokedAt instanceof Date));
  assert.equal(t().clientSession.find((s) => s.id === "s_2")!.revokedAt, null);
  assert.deepEqual(t().pushDevice.map((d) => d.id).sort(), ["d_2", "d_staff"]);
  assert.deepEqual(audits.map((a) => [a.action, a.entityId]), [["disable", "cu_1"]]);
});

test("enabling a user who has signed in before makes them ACTIVE; one who never did is INVITED again", async () => {
  addUser("cu_1", { status: "DISABLED", lastLoginAt: NOW });
  addUser("cu_2", { status: "DISABLED", lastLoginAt: null });
  assert.equal((await actions.setClientUserDisabled("cu_1", false)).success, true);
  assert.equal((await actions.setClientUserDisabled("cu_2", false)).success, true);
  assert.equal(t().clientUser.find((u) => u.id === "cu_1")!.status, "ACTIVE");
  assert.equal(t().clientUser.find((u) => u.id === "cu_2")!.status, "INVITED");
});

test("revokeClientUserSessions signs the user out everywhere but keeps the account usable", async () => {
  addUser("cu_1");
  t().clientSession.push({ id: "s_1", clientUserId: "cu_1", revokedAt: null, createdAt: NOW, lastSeenAt: NOW });
  const result = await actions.revokeClientUserSessions("cu_1");
  assert.equal(result.success, true);
  assert.ok(t().clientSession[0].revokedAt instanceof Date);
  assert.equal(t().clientUser[0].status, "ACTIVE");
  assert.deepEqual(audits.map((a) => a.action), ["revoke_sessions"]);
});

test("actions on an unknown client user fail cleanly", async () => {
  for (const r of [actions.resendInvite("nope"), actions.setClientUserDisabled("nope", true), actions.revokeClientUserSessions("nope")]) {
    assert.equal((await r).success, false);
  }
  assert.equal(audits.length, 0);
});

test("an invite email that fails to send is reported, not shown as sent, and its code is withdrawn", async () => {
  inviteResult = { success: false };
  const added = await actions.addClientUser("client_a", { email: "new@acme.test", name: "New", language: "en" });
  assert.equal(added.success, false);
  assert.match((added as { error: string }).error, /couldn't be sent/i);
  // The user exists and the add is audit-logged; the unused code is gone.
  assert.equal(t().clientUser.length, 1);
  assert.deepEqual(audits.map((a) => a.action), ["invite"]);
  assert.equal(t().clientLoginCode.length, 0);

  const resent = await actions.resendInvite(t().clientUser[0].id);
  assert.equal(resent.success, false);
  assert.equal(t().clientLoginCode.length, 0);

  inviteResult = { success: false, skipped: true }; // RESEND_API_KEY missing
  assert.equal((await actions.resendInvite(t().clientUser[0].id)).success, false);
});
