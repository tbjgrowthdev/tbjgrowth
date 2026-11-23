// Run with: npm test
//
// Portal "More" tab: booking a call, sending a request, language, account
// deletion requests, and the staff inbox for them. Against the shared fake
// database, a fake mailer and a fake client session.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";
import { hasPermission, type Permission } from "@/lib/permissions";

let db = createFakePrisma(CLIENT_HUB_SCHEMA, { unique: { booking: ["slotId"] } });
const proxy = new Proxy({}, { get: (_t, k) => (db as Row)[k as string] });
const t = () => db._tables as Record<string, Row[]>;
const NOW = new Date("2026-11-23T10:00:00Z");
const HOUR = 3600 * 1000;

class ClientAuthError extends Error {}
class AuthError extends Error {}
let ctx: { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" } | null = null;
let role = "ADMIN";
let mails: Array<{ kind: string; to: string | null | undefined; body: Row }> = [];
let adminPushes: string[] = [];
let audits: Array<{ action: string; entityType: string }> = [];

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
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => ({ user: { id: "staff_1", role } }),
    requirePermission: async (p: Permission) => {
      if (!hasPermission(role as never, p)) throw new AuthError(`Missing required permission: ${p}`);
      return { user: { id: "staff_1", role } };
    },
  },
});
mock.module("@/lib/email", {
  namedExports: {
    sendBookingNotification: async (b: Row, to: string | null | undefined) => (mails.push({ kind: "booking", to, body: b }), { success: true }),
    sendClientRequestNotification: async (p: Row) => (mails.push({ kind: "request", to: p.to, body: p }), { success: true }),
    sendAccountDeletionRequestNotification: async (p: Row) => (mails.push({ kind: "deletion", to: p.to, body: p }), { success: true }),
  },
});
mock.module("@/lib/push/notify", { namedExports: { scheduleAdminPush: (e: string) => void adminPushes.push(e) } });
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (p: (typeof audits)[number]) => void audits.push(p) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/revalidate", { namedExports: { revalidatePath: () => {} } });
mock.module("@/lib/clients/clock", { namedExports: { now: () => new Date(NOW) } });

const booking = await import("../app/(portal)/actions/booking");
const requests = await import("../app/(portal)/actions/requests");
const profile = await import("../app/(portal)/actions/profile");
const inbox = await import("../app/(admin)/actions/client-requests");
const data = await import("@/lib/portal/data");

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA, { unique: { booking: ["slotId"] } });
  mails = [];
  adminPushes = [];
  audits = [];
  role = "ADMIN";
  t().user.push({ id: "staff_am", name: "Ana Manager", email: "ana@tbj.test", role: "ADMIN" });
  t().siteSetting.push({ id: "s", email: "hello@tbj.test" });
  for (const tag of ["a", "b"]) {
    t().client.push({ id: `client_${tag}`, name: `Client ${tag} Ltd`, accountManagerId: tag === "a" ? "staff_am" : null, whatsapp: null, phone: null, notes: null });
    t().clientUser.push({ id: `cu_${tag}`, clientId: `client_${tag}`, email: `${tag}@x.test`, name: `User ${tag}`, language: "en", status: "ACTIVE", deletionRequestedAt: null });
  }
  t().availableSlot.push({ id: "slot_free", startsAt: new Date(NOW.getTime() + 24 * HOUR), duration: 30, isBooked: false, updatedAt: NOW });
  t().availableSlot.push({ id: "slot_past", startsAt: new Date(NOW.getTime() - HOUR), duration: 30, isBooked: false, updatedAt: NOW });
  ctx = { clientUserId: "cu_a", clientId: "client_a", sessionId: "s_a", language: "en" };
});

// ---- booking ----

test("booking links the client user and prefills", async () => {
  const r = await booking.bookCall({ slotId: "slot_free", message: "About the launch" });
  assert.equal(r.success, true);
  const b = t().booking[0];
  assert.equal(b.clientUserId, "cu_a");
  assert.equal(b.name, "User a");
  assert.equal(b.email, "a@x.test");
  assert.equal(b.company, "Client a Ltd");
  assert.equal(b.message, "About the launch");
  assert.equal(b.status, "CONFIRMED");
  assert.equal(t().availableSlot.find((s) => s.id === "slot_free")!.isBooked, true);
  assert.equal(mails.filter((m) => m.kind === "booking").length, 1);
  assert.deepEqual(adminPushes, ["NEW_BOOKING"]);
  assert.deepEqual((await data.listMeetings(ctx!, NOW)).map((m) => m.id), [b.id]);
});

test("a client cannot book a taken slot", async () => {
  assert.equal((await booking.bookCall({ slotId: "slot_free" })).success, true);
  ctx = { clientUserId: "cu_b", clientId: "client_b", sessionId: "s_b", language: "en" };
  const r = await booking.bookCall({ slotId: "slot_free" });
  assert.equal(r.success, false);
  assert.equal(t().booking.length, 1);
  assert.equal(t().booking[0].clientUserId, "cu_a");
});

test("even if the slot flag is out of date, the unique slotId still protects", async () => {
  t().booking.push({ id: "bk_public", slotId: "slot_free", name: "Web visitor", email: "v@x.test", status: "CONFIRMED", clientUserId: null });
  const r = await booking.bookCall({ slotId: "slot_free" });
  assert.equal(r.success, false);
  assert.equal(t().booking.length, 1);
  // The slot stays booked: the public booking owns it.
  assert.equal(t().availableSlot.find((s) => s.id === "slot_free")!.isBooked, true);
});

test("past and unknown slots can't be booked", async () => {
  assert.equal((await booking.bookCall({ slotId: "slot_past" })).success, false);
  assert.equal((await booking.bookCall({ slotId: "nope" })).success, false);
  assert.equal(t().booking.length, 0);
});

test("open slots list only future, free slots", async () => {
  assert.deepEqual((await data.listOpenSlots(ctx!, NOW)).map((s) => s.id), ["slot_free"]);
});

// ---- requests ----

test("request is created for the session client only, and staff are emailed", async () => {
  const r = await requests.sendRequest({ message: "  Please call me about the logo  " });
  assert.equal(r.success, true);
  const row = t().clientRequest[0];
  assert.deepEqual([row.clientId, row.clientUserId, row.message, row.status], ["client_a", "cu_a", "Please call me about the logo", "OPEN"]);
  const mail = mails.find((m) => m.kind === "request")!;
  assert.equal(mail.to, "ana@tbj.test"); // the account manager
  assert.equal(mail.body.clientName, "Client a Ltd");
  // Another client sees nothing of it.
  assert.deepEqual(await data.listRequests({ clientUserId: "cu_b", clientId: "client_b", sessionId: "s_b", language: "en" }), []);
});

test("without an account manager, requests go to the site's notification email", async () => {
  ctx = { clientUserId: "cu_b", clientId: "client_b", sessionId: "s_b", language: "en" };
  await requests.sendRequest({ message: "Hi" });
  assert.equal(mails.find((m) => m.kind === "request")!.to, "hello@tbj.test");
});

test("an empty or too long request is refused", async () => {
  assert.equal((await requests.sendRequest({ message: "   " })).success, false);
  assert.equal((await requests.sendRequest({ message: "x".repeat(2001) })).success, false);
  assert.equal(t().clientRequest.length, 0);
  assert.equal(mails.length, 0);
});

test("no session: nothing is created", async () => {
  ctx = null;
  assert.equal((await requests.sendRequest({ message: "Hi" })).success, false);
  assert.equal((await booking.bookCall({ slotId: "slot_free" })).success, false);
  assert.equal((await profile.setLanguage({ language: "bn" })).success, false);
  assert.equal(t().clientRequest.length + t().booking.length, 0);
});

// ---- profile ----

test("language change persists", async () => {
  assert.equal((await profile.setLanguage({ language: "bn" })).success, true);
  assert.equal(t().clientUser.find((u) => u.id === "cu_a")!.language, "bn");
  assert.equal((await profile.setLanguage({ language: "fr" as never })).success, false);
  assert.equal(t().clientUser.find((u) => u.id === "cu_a")!.language, "bn");
  assert.equal(t().clientUser.find((u) => u.id === "cu_b")!.language, "en");
});

test("deletion request is recorded and staff are emailed (once)", async () => {
  assert.equal((await profile.requestAccountDeletion()).success, true);
  const u = t().clientUser.find((x) => x.id === "cu_a")!;
  assert.equal(new Date(u.deletionRequestedAt).getTime(), NOW.getTime());
  assert.equal(mails.filter((m) => m.kind === "deletion").length, 1);
  assert.equal(mails.find((m) => m.kind === "deletion")!.to, "ana@tbj.test");
  // Asking again doesn't email again.
  assert.equal((await profile.requestAccountDeletion()).success, true);
  assert.equal(mails.filter((m) => m.kind === "deletion").length, 1);
  assert.ok(audits.some((a) => a.action === "request_deletion"));
});

// ---- staff inbox ----

test("staff inbox lists requests and deletion requests; only client staff can open it or mark done", async () => {
  await requests.sendRequest({ message: "Call me" });
  await profile.requestAccountDeletion();
  const box = await inbox.getClientInbox();
  assert.equal(box.requests.length, 1);
  assert.equal(box.requests[0].clientName, "Client a Ltd");
  assert.deepEqual(box.deletionRequests.map((d) => d.email), ["a@x.test"]);

  role = "EDITOR";
  assert.equal((await inbox.setClientRequestStatus(t().clientRequest[0].id, "DONE")).success, true);
  assert.equal(t().clientRequest[0].status, "DONE");
  assert.equal((await inbox.setClientRequestStatus(t().clientRequest[0].id, "BOGUS" as never)).success, false);

  for (const r of ["SEO_MANAGER", "CONTRIBUTOR"]) {
    role = r;
    assert.deepEqual(await inbox.getClientInbox(), { requests: [], deletionRequests: [] });
    assert.equal((await inbox.setClientRequestStatus(t().clientRequest[0].id, "OPEN")).success, false);
  }
});

test("a slot freed by a cancelled booking can be booked from the portal", async () => {
  t().booking.push({ id: "bk_cancelled", slotId: "slot_free", name: "Old", email: "o@x.test", status: "CANCELLED", clientUserId: null });
  const r = await booking.bookCall({ slotId: "slot_free" });
  assert.equal(r.success, true);
  const live = t().booking.filter((b) => b.slotId === "slot_free");
  assert.equal(live.length, 1);
  assert.deepEqual([live[0].status, live[0].clientUserId], ["CONFIRMED", "cu_a"]);
  assert.equal(t().availableSlot.find((s) => s.id === "slot_free")!.isBooked, true);
  // The cancelled booking is kept, detached from the slot, and still knows when it was.
  const old = t().booking.find((b) => b.id === "bk_cancelled");
  assert.ok(old, "the cancelled booking record is kept");
  assert.equal(old.status, "CANCELLED");
  assert.equal(old.slotId, null);
  assert.equal(new Date(old.slotStartsAt).getTime(), NOW.getTime() + 24 * HOUR);
  assert.equal(old.slotDuration, 30);
});

test("two cancelled bookings can be detached from slots in turn (empty slotIds don't clash)", async () => {
  t().availableSlot.push({ id: "slot_two", startsAt: new Date(NOW.getTime() + 48 * HOUR), duration: 45, isBooked: false, updatedAt: NOW });
  t().booking.push({ id: "bk_c1", slotId: "slot_free", name: "Old", email: "o@x.test", status: "CANCELLED", clientUserId: null });
  t().booking.push({ id: "bk_c2", slotId: "slot_two", name: "Old2", email: "o2@x.test", status: "CANCELLED", clientUserId: null });
  assert.equal((await booking.bookCall({ slotId: "slot_free" })).success, true);
  assert.equal((await booking.bookCall({ slotId: "slot_two" })).success, true);
  assert.equal(t().booking.length, 4);
  assert.equal(t().booking.find((b) => b.id === "bk_c2")!.slotDuration, 45);
});
