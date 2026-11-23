// Run with: npm test
//
// Client push (lib/push/client-notify.ts, lib/push/recipients.ts,
// lib/push/messages.ts), client device registration and preferences
// (app/(portal)/actions/push.ts), and the reminder cron
// (lib/clients/reminders.ts behind /api/cron/client-reminders).
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createFakePrisma, CLIENT_HUB_SCHEMA, type Row } from "./helpers/fake-prisma";

process.env.CRON_SECRET = "test-cron-secret-0123456789";

let db = createFakePrisma(CLIENT_HUB_SCHEMA);
const proxy = new Proxy({}, { get: (_t, k) => (db as Row)[k as string] });
const t = () => db._tables as Record<string, Row[]>;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
let NOW = new Date("2026-11-23T10:00:00Z");

let sent: Array<{ tokens: string[]; msg: { title: string; body: string; url: string } }> = [];
let fcmFails = false;
let mails: Array<{ to: string; body: Row }> = [];
class ClientAuthError extends Error {}
let ctx: { clientUserId: string; clientId: string; sessionId: string; language: "en" | "bn" } | null = null;

mock.module("@/lib/prisma", { namedExports: { prisma: proxy }, defaultExport: proxy });
mock.module("@/lib/push/fcm", {
  namedExports: {
    sendFcm: async (tokens: string[], msg: { title: string; body: string; url: string }) => {
      if (fcmFails) throw new Error("FCM down");
      sent.push({ tokens: [...tokens].sort(), msg });
      return { sent: tokens.length, invalidTokens: tokens.filter((x) => x.startsWith("dead")) };
    },
  },
});
mock.module("@/lib/email", {
  namedExports: {
    sendStaleProjectNudge: async (p: Row) => (mails.push({ to: p.to, body: p }), { success: true }),
    sendClientLoginCode: async () => ({ success: true }),
  },
});
mock.module("next/headers", { namedExports: { cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }), headers: async () => new Headers() } });
mock.module("@/lib/clients/clock", { namedExports: { now: () => new Date(NOW) } });

const notify = await import("@/lib/push/client-notify");
const messages = await import("@/lib/push/messages");
const reminders = await import("@/lib/clients/reminders");
const auth = await import("@/lib/portal/auth");
const { safePortalPath } = await import("@/lib/portal/paths");

// Client push actions, with requireClient replaced by the test's context.
const portalPush = await (async () => {
  const real = auth;
  mock.module("@/lib/portal/auth", {
    namedExports: {
      ...real,
      ClientAuthError,
      requireClient: async () => {
        if (!ctx) throw new ClientAuthError("Please sign in again.");
        return ctx;
      },
    },
  });
  return import("../app/(portal)/actions/push");
})();
const route = await import("../app/api/cron/client-reminders/route");

beforeEach(() => {
  db = createFakePrisma(CLIENT_HUB_SCHEMA, { unique: { pushDevice: ["token"] } });
  NOW = new Date("2026-11-23T10:00:00Z");
  sent = [];
  mails = [];
  fcmFails = false;
  ctx = { clientUserId: "cu_a1", clientId: "client_a", sessionId: "s_a1", language: "en" };
  t().user.push({ id: "staff_am", name: "Ana Manager", email: "ana@tbj.test", role: "ADMIN" });
  t().user.push({ id: "staff_other", name: "Bo", email: "bo@tbj.test", role: "ADMIN" });
  t().adminSession.push({ id: "as_am", revokedAt: null });
  t().adminSession.push({ id: "as_other", revokedAt: null });
  t().client.push({ id: "client_a", name: "Acme Secret Ltd", accountManagerId: "staff_am" });
  t().client.push({ id: "client_b", name: "Bravo Ltd", accountManagerId: "staff_other" });
  t().clientUser.push({ id: "cu_a1", clientId: "client_a", email: "a1@x.test", name: "Anna Client", language: "en", status: "ACTIVE" });
  t().clientUser.push({ id: "cu_a2", clientId: "client_a", email: "a2@x.test", name: "Arif Client", language: "bn", status: "ACTIVE" });
  t().clientUser.push({ id: "cu_a3", clientId: "client_a", email: "a3@x.test", name: "Off", language: "en", status: "DISABLED" });
  t().clientUser.push({ id: "cu_b1", clientId: "client_b", email: "b1@x.test", name: "Bob", language: "en", status: "ACTIVE" });
  const dev = (id: string, over: Row) => t().pushDevice.push({ id, userId: null, clientUserId: null, adminSessionId: null, platform: "android", token: `tok_${id}`, lastSeenAt: NOW, createdAt: NOW, ...over });
  dev("a1", { clientUserId: "cu_a1" });
  dev("a2", { clientUserId: "cu_a2" });
  dev("a3", { clientUserId: "cu_a3" });
  dev("b1", { clientUserId: "cu_b1" });
  dev("staff", { userId: "staff_am", adminSessionId: "as_am" });
  dev("staff2", { userId: "staff_other", adminSessionId: "as_other" });
});

const tokensSent = () => sent.flatMap((s) => s.tokens).sort();

// ---- content and routing ----

test("payloads contain no names, amounts, titles or invoice numbers", async () => {
  const forbidden = ["Acme", "Anna", "Arif", "INV-", "৳", "£", "Homepage", "1500"];
  for (const lang of ["en", "bn"] as const) {
    for (const [event, msg] of Object.entries(messages.CLIENT_PUSH_MESSAGES[lang])) {
      const text = JSON.stringify(msg);
      for (const f of forbidden) assert.equal(text.includes(f), false, `${lang} ${event} contains ${f}`);
    }
  }
  assert.deepEqual(messages.CLIENT_PUSH_MESSAGES.en.CLIENT_PROJECT_UPDATE, { title: "Project update", body: "There is a new update on your project.", url: "/portal/projects" });
  assert.deepEqual(messages.CLIENT_PUSH_MESSAGES.en.CLIENT_APPROVAL_NEEDED, { title: "Your approval is needed", body: "Open the app to review.", url: "/portal" });
  assert.deepEqual(messages.CLIENT_PUSH_MESSAGES.en.CLIENT_REPORT_READY, { title: "Report ready", body: "A new report is available.", url: "/portal/reports" });
  assert.deepEqual(messages.CLIENT_PUSH_MESSAGES.en.CLIENT_INVOICE_DUE, { title: "Invoice due", body: "You have an invoice to review.", url: "/portal/billing" });
  assert.deepEqual(messages.CLIENT_PUSH_MESSAGES.en.CLIENT_MEETING_REMINDER, { title: "Meeting reminder", body: "You have an upcoming meeting.", url: "/portal/more" });
  await notify.notifyClients("CLIENT_INVOICE_DUE", "client_a");
  for (const s of sent) for (const f of forbidden) assert.equal(JSON.stringify(s.msg).includes(f), false);
});

test("safePortalPath rejects /admin and external urls; every client push opens a safe /portal path", () => {
  for (const bad of ["/admin", "/admin/clients", "https://evil.test/portal", "//evil.test/portal", "javascript:alert(1)", "/portal/../admin", "/portal/%2e%2e/admin", "/portalx"]) {
    assert.equal(safePortalPath(bad), null, bad);
  }
  for (const lang of ["en", "bn"] as const) {
    for (const msg of Object.values(messages.CLIENT_PUSH_MESSAGES[lang])) assert.equal(safePortalPath(msg.url), msg.url);
  }
});

test("only the target client's devices are notified, in each user's language", async () => {
  await notify.notifyClients("CLIENT_PROJECT_UPDATE", "client_a");
  assert.deepEqual(tokensSent(), ["tok_a1", "tok_a2"]); // not the disabled user, not client B, not staff
  const en = sent.find((s) => s.tokens.includes("tok_a1"))!;
  const bn = sent.find((s) => s.tokens.includes("tok_a2"))!;
  assert.equal(en.msg.title, "Project update");
  assert.equal(bn.msg.title, messages.CLIENT_PUSH_MESSAGES.bn.CLIENT_PROJECT_UPDATE.title);
});

test("a client user who turned an event off doesn't get it; defaults are on", async () => {
  t().clientPushPreference.push({ clientUserId: "cu_a2", event: "CLIENT_REPORT_READY", enabled: false });
  await notify.notifyClients("CLIENT_REPORT_READY", "client_a");
  assert.deepEqual(tokensSent(), ["tok_a1"]);
});

test("dead tokens are removed; an FCM failure never throws", async () => {
  t().pushDevice.find((d) => d.id === "a1")!.token = "dead_a1";
  await notify.notifyClients("CLIENT_PROJECT_UPDATE", "client_a");
  assert.equal(t().pushDevice.some((d) => d.token === "dead_a1"), false);
  fcmFails = true;
  await notify.notifyClients("CLIENT_PROJECT_UPDATE", "client_a"); // resolves
});

test("staff pushes never go to client devices", async () => {
  const { recipientTokens } = await import("@/lib/push/recipients");
  const tokens = await recipientTokens("NEW_BOOKING");
  assert.ok(tokens.every((x) => x === "tok_staff" || x === "tok_staff2"));
});

// ---- devices and preferences ----

test("registerClientPushDevice stores the token for the client user only, clearing any staff owner", async () => {
  t().pushDevice.push({ id: "shared", userId: "staff_am", clientUserId: null, adminSessionId: "as_am", platform: "android", token: "tok_shared", lastSeenAt: NOW });
  assert.equal((await portalPush.registerClientPushDevice({ token: "tok_shared", platform: "android" })).success, true);
  const d = t().pushDevice.find((x) => x.token === "tok_shared")!;
  assert.deepEqual([d.clientUserId, d.userId, d.adminSessionId], ["cu_a1", null, null]);
  assert.equal((await portalPush.registerClientPushDevice({ token: "tok_new", platform: "android" })).success, true);
  assert.equal(t().pushDevice.find((x) => x.token === "tok_new")!.clientUserId, "cu_a1");
  ctx = null;
  assert.equal((await portalPush.registerClientPushDevice({ token: "tok_x", platform: "android" })).success, false);
});

test("staff device registration clears a client owner (one owner per device)", async () => {
  mock.module("@/lib/auth-guard", { namedExports: { AuthError: class extends Error {}, requireSession: async () => ({ user: { id: "staff_am", role: "ADMIN", sessionId: "as_am" } }) } });
  const staffPush = await import("../app/(admin)/actions/push");
  t().pushDevice.find((d) => d.id === "a1")!.token = "tok_moving";
  db.pushDevice.upsert = async ({ where, create, update }: Row) => {
    const existing = t().pushDevice.find((d) => d.token === where.token);
    if (existing) return Object.assign(existing, update);
    t().pushDevice.push({ id: "new", ...create });
    return create;
  };
  assert.equal((await staffPush.registerPushDevice({ token: "tok_moving", platform: "android" })).success, true);
  const d = t().pushDevice.find((x) => x.token === "tok_moving")!;
  assert.deepEqual([d.userId, d.clientUserId], ["staff_am", null]);
});

test("unregister removes only the client's own device", async () => {
  assert.equal((await portalPush.unregisterClientPushDevice("tok_b1")).success, true);
  assert.ok(t().pushDevice.some((d) => d.token === "tok_b1"));
  assert.equal((await portalPush.unregisterClientPushDevice("tok_a1")).success, true);
  assert.equal(t().pushDevice.some((d) => d.token === "tok_a1"), false);
});

test("preferences: all on by default, and a change is stored for this user only", async () => {
  const prefs = await portalPush.getClientPushPreferences();
  assert.ok(prefs.success && prefs.preferences.every((p) => p.enabled));
  assert.equal((await portalPush.setClientPushPreference("CLIENT_INVOICE_DUE", false)).success, true);
  assert.equal((await portalPush.setClientPushPreference("CLIENT_INVOICE_DUE", false)).success, true);
  // The overdue push follows the "invoice due" setting.
  assert.deepEqual(t().clientPushPreference.map((p) => [p.clientUserId, p.event, p.enabled]), [
    ["cu_a1", "CLIENT_INVOICE_DUE", false],
    ["cu_a1", "CLIENT_INVOICE_OVERDUE", false],
  ]);
  assert.equal((await portalPush.setClientPushPreference("NEW_LEAD" as never, false)).success, false);
});

test("sign-out and disable delete that client's devices", async () => {
  t().clientSession.push({ id: "s_a1", clientUserId: "cu_a1", revokedAt: null, lastSeenAt: NOW, createdAt: NOW });
  await auth.endClientSession({ clientUserId: "cu_a1", sessionId: "s_a1" });
  assert.equal(t().pushDevice.some((d) => d.clientUserId === "cu_a1"), false);
  assert.ok(t().clientSession[0].revokedAt instanceof Date);
  await auth.revokeAllClientSessions("cu_a2");
  assert.equal(t().pushDevice.some((d) => d.clientUserId === "cu_a2"), false);
  assert.ok(t().pushDevice.some((d) => d.clientUserId === "cu_b1"));
});

test("a push-table problem never blocks sign-out", async () => {
  t().clientSession.push({ id: "s_a1", clientUserId: "cu_a1", revokedAt: null, lastSeenAt: NOW, createdAt: NOW });
  db.pushDevice.deleteMany = async () => {
    throw new Error("push table down");
  };
  await auth.endClientSession({ clientUserId: "cu_a1", sessionId: "s_a1" });
  assert.ok(t().clientSession[0].revokedAt instanceof Date);
});

// ---- reminder cron ----

function seedMeeting(id: string, startsIn: number, clientUserId = "cu_a1") {
  t().availableSlot.push({ id: `slot_${id}`, startsAt: new Date(NOW.getTime() + startsIn), duration: 30, isBooked: true });
  t().booking.push({ id, slotId: `slot_${id}`, name: "x", email: "x@x.test", status: "CONFIRMED", clientUserId, reminder24hSentAt: null, reminder1hSentAt: null });
}

test("meeting reminders go out about 24 h and 1 h ahead, and the cron is idempotent (no double reminders)", async () => {
  seedMeeting("bk_tomorrow", 20 * HOUR);
  seedMeeting("bk_soon", 40 * 60 * 1000);
  seedMeeting("bk_far", 3 * DAY);
  await reminders.runClientReminders(NOW);
  await reminders.runClientReminders(NOW);
  const meetingPushes = sent.filter((s) => s.msg.url === "/portal/more");
  assert.equal(meetingPushes.length, 4); // 2 bookings x (en + bn) recipients of client_a
  const b = (id: string) => t().booking.find((x) => x.id === id)!;
  assert.ok(b("bk_tomorrow").reminder24hSentAt);
  assert.equal(b("bk_tomorrow").reminder1hSentAt, null);
  assert.ok(b("bk_soon").reminder1hSentAt);
  assert.equal(b("bk_far").reminder24hSentAt, null);
  // 19 h later the first one is within the hour: one more reminder, once.
  NOW = new Date(NOW.getTime() + 19.5 * HOUR);
  await reminders.runClientReminders(NOW);
  await reminders.runClientReminders(NOW);
  assert.ok(b("bk_tomorrow").reminder1hSentAt);
  assert.equal(sent.filter((s) => s.msg.url === "/portal/more").length, 6);
});

test("overdue transition notifies once", async () => {
  t().invoice.push({ id: "inv_late", clientId: "client_a", number: "INV-1", amountMinor: 150000, currency: "BDT", status: "DUE", issueDate: new Date(NOW.getTime() - 10 * DAY), dueDate: new Date(NOW.getTime() - 2 * DAY), overdueNotifiedAt: null });
  t().invoice.push({ id: "inv_ok", clientId: "client_a", number: "INV-2", amountMinor: 150000, currency: "BDT", status: "DUE", issueDate: NOW, dueDate: new Date(NOW.getTime() + 5 * DAY), overdueNotifiedAt: null });
  t().invoice.push({ id: "inv_paid", clientId: "client_b", number: "INV-3", amountMinor: 1, currency: "GBP", status: "PAID", issueDate: NOW, dueDate: new Date(NOW.getTime() - 5 * DAY), overdueNotifiedAt: null });
  await reminders.runClientReminders(NOW);
  await reminders.runClientReminders(NOW);
  const inv = (id: string) => t().invoice.find((x) => x.id === id)!;
  assert.equal(inv("inv_late").status, "OVERDUE");
  assert.ok(inv("inv_late").overdueNotifiedAt);
  assert.equal(inv("inv_ok").status, "DUE");
  assert.equal(inv("inv_paid").status, "PAID");
  const billing = sent.filter((s) => s.msg.url === "/portal/billing");
  assert.equal(billing.length, 2); // client_a's en + bn users, once
  assert.ok(billing.every((s) => s.tokens.every((x) => x === "tok_a1" || x === "tok_a2")));
});

test("stale-project nudge goes to the account manager only, once per interval, never to the client, and respects a changed interval", async () => {
  t().project.push({ id: "proj_stale", clientId: "client_a", title: "Secret Website", status: "IN_PROGRESS", progress: 10, updateIntervalDays: null, lastUpdateNudgeAt: null, lastClientNotifyAt: null, createdAt: new Date(NOW.getTime() - 30 * DAY) });
  await reminders.runClientReminders(NOW);
  await reminders.runClientReminders(NOW);
  const staffPushes = sent.filter((s) => s.msg.url.startsWith("/admin"));
  assert.equal(staffPushes.length, 1);
  assert.deepEqual(staffPushes[0].tokens, ["tok_staff"]);
  assert.equal(JSON.stringify(staffPushes[0].msg).includes("Secret"), false); // lock-screen safe
  assert.ok(sent.every((s) => !s.tokens.some((x) => x.startsWith("tok_a") || x.startsWith("tok_b"))));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "ana@tbj.test");

  // 6 days later (default interval 7): no second nudge yet.
  NOW = new Date(NOW.getTime() + 6 * DAY);
  await reminders.runClientReminders(NOW);
  assert.equal(mails.length, 1);
  // Interval shortened to 3 days: nudged again now.
  t().project[0].updateIntervalDays = 3;
  await reminders.runClientReminders(NOW);
  assert.equal(mails.length, 2);
  // Interval 0: off.
  t().project[0].updateIntervalDays = 0;
  NOW = new Date(NOW.getTime() + 30 * DAY);
  await reminders.runClientReminders(NOW);
  assert.equal(mails.length, 2);
});

test("a project without an account manager is not nudged", async () => {
  t().project.push({ id: "proj_b", clientId: "client_b", title: "B", status: "IN_PROGRESS", progress: 0, updateIntervalDays: null, lastUpdateNudgeAt: null, lastClientNotifyAt: null, createdAt: new Date(NOW.getTime() - 30 * DAY) });
  t().client.find((c) => c.id === "client_b")!.accountManagerId = null;
  await reminders.runClientReminders(NOW);
  assert.equal(mails.length, 0);
});

test("the cron route needs the bearer CRON_SECRET", async () => {
  const { NextRequest } = await import("next/server");
  assert.equal((await route.GET(new NextRequest("https://x.test/api/cron/client-reminders"))).status, 401);
  const ok = await route.GET(new NextRequest("https://x.test/api/cron/client-reminders", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  assert.equal(ok.status, 200);
});

test("two overlapping cron runs send each reminder, overdue notice and nudge once", async () => {
  seedMeeting("bk_tomorrow", 20 * HOUR);
  t().invoice.push({ id: "inv_late", clientId: "client_a", number: "INV-1", amountMinor: 1, currency: "BDT", status: "DUE", issueDate: new Date(NOW.getTime() - 10 * DAY), dueDate: new Date(NOW.getTime() - 2 * DAY), overdueNotifiedAt: null });
  t().project.push({ id: "proj_stale", clientId: "client_a", title: "P", status: "IN_PROGRESS", progress: 0, updateIntervalDays: null, lastUpdateNudgeAt: null, lastClientNotifyAt: null, createdAt: new Date(NOW.getTime() - 30 * DAY) });
  await Promise.all([reminders.runClientReminders(NOW), reminders.runClientReminders(NOW)]);
  assert.equal(sent.filter((s) => s.msg.url === "/portal/more").length, 2); // en + bn, once
  assert.equal(sent.filter((s) => s.msg.url === "/portal/billing").length, 2);
  assert.equal(mails.length, 1);
});
