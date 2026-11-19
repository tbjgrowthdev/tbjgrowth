// Run with: npm test
//
// Who receives which push (lib/push/recipients.ts) and the device lifecycle
// around logout/revoke (lib/session-tracking.ts), against a fake database.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR" | "SEO_MANAGER" | "CONTRIBUTOR";
type Device = { id: string; userId: string; adminSessionId: string | null; token: string; lastSeenAt: Date };
type Pref = { userId: string; event: string; enabled: boolean };
type Session = { id: string; userId: string; revokedAt: Date | null; lastSeenAt: Date };

let users: Array<{ id: string; role: Role }> = [];
let devices: Device[] = [];
let prefs: Pref[] = [];
let sessions: Session[] = [];
let failSessionUpdateMany = false;

// Loose shape of the Prisma where/select objects the fake understands.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

function matchDevice(d: Device, where: Q): boolean {
  if (!where) return true;
  if (where.lastSeenAt?.lt && !(d.lastSeenAt < where.lastSeenAt.lt)) return false;
  if (where.lastSeenAt?.gte && !(d.lastSeenAt >= where.lastSeenAt.gte)) return false;
  if (where.adminSessionId !== undefined) {
    const c = where.adminSessionId;
    if (typeof c === "string" || c === null) {
      if (d.adminSessionId !== c) return false;
    } else if (c?.not !== undefined && d.adminSessionId === c.not) return false;
  }
  if (where.userId !== undefined && d.userId !== where.userId) return false;
  if (where.adminSession?.revokedAt === null) {
    const s = sessions.find((x) => x.id === d.adminSessionId);
    if (!s || s.revokedAt !== null) return false;
  }
  return true;
}

const fakePrisma = {
  pushDevice: {
    async deleteMany({ where }: { where: Q }) {
      const before = devices.length;
      devices = devices.filter((d) => !matchDevice(d, where));
      return { count: before - devices.length };
    },
    async findMany({ where, select }: { where: Q; select: Q }) {
      const event = select.user.select.pushPreferences.where.event;
      return devices
        .filter((d) => matchDevice(d, where))
        .map((d) => {
          const user = users.find((u) => u.id === d.userId)!;
          return { token: d.token, user: { role: user.role, pushPreferences: prefs.filter((p) => p.userId === d.userId && p.event === event) } };
        });
    },
  },
  adminSession: {
    async findUnique({ where }: { where: { id: string } }) {
      return sessions.find((s) => s.id === where.id) ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Session> }) {
      const s = sessions.find((x) => x.id === where.id)!;
      Object.assign(s, data);
      return s;
    },
    async updateMany({ where, data }: { where: Q; data: Partial<Session> }) {
      if (failSessionUpdateMany) throw new Error("updateMany is not supported by the Neon HTTP adapter");
      let count = 0;
      for (const s of sessions) {
        if (s.userId === where.userId && s.revokedAt === null && s.id !== where.id.not) {
          Object.assign(s, data);
          count++;
        }
      }
      return { count };
    },
  },
};
mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });

const { eligibleEvents, defaultEnabled, recipientTokens } = await import("@/lib/push/recipients");
const { revokeAdminSession, revokeAllOtherAdminSessions } = await import("@/lib/session-tracking");

function addUser(id: string, role: Role, sessionId = `s_${id}`, lastSeen = ago(DAY)) {
  users.push({ id, role });
  sessions.push({ id: sessionId, userId: id, revokedAt: null, lastSeenAt: new Date() });
  devices.push({ id: `d_${id}`, userId: id, adminSessionId: sessionId, token: `tok_${id}`, lastSeenAt: lastSeen });
}

beforeEach(() => {
  users = [];
  devices = [];
  prefs = [];
  sessions = [];
  failSessionUpdateMany = false;
});

test("eligibleEvents follows the permissions that guard each admin page", () => {
  assert.deepEqual(eligibleEvents("SUPER_ADMIN"), ["NEW_LEAD", "NEW_BOOKING", "CONTENT_AWAITING_APPROVAL"]);
  assert.deepEqual(eligibleEvents("ADMIN"), ["NEW_LEAD", "NEW_BOOKING", "CONTENT_AWAITING_APPROVAL"]);
  assert.deepEqual(eligibleEvents("EDITOR"), ["NEW_BOOKING", "CONTENT_AWAITING_APPROVAL"]);
  assert.deepEqual(eligibleEvents("SEO_MANAGER"), ["NEW_BOOKING"]);
  assert.deepEqual(eligibleEvents("CONTRIBUTOR"), ["NEW_BOOKING"]);
});

test("defaultEnabled is on for SUPER_ADMIN, ADMIN, EDITOR and off for CONTRIBUTOR, SEO_MANAGER", () => {
  assert.equal(defaultEnabled("ADMIN", "NEW_LEAD"), true);
  assert.equal(defaultEnabled("EDITOR", "NEW_BOOKING"), true);
  assert.equal(defaultEnabled("SEO_MANAGER", "NEW_BOOKING"), false);
  assert.equal(defaultEnabled("CONTRIBUTOR", "NEW_BOOKING"), false);
});

test("CONTRIBUTOR is never a NEW_LEAD recipient even with an explicit enabled preference", async () => {
  addUser("c", "CONTRIBUTOR");
  prefs.push({ userId: "c", event: "NEW_LEAD", enabled: true });
  assert.deepEqual(await recipientTokens("NEW_LEAD"), []);
});

test("EDITOR gets NEW_BOOKING and CONTENT_AWAITING_APPROVAL by default but not NEW_LEAD", async () => {
  addUser("e", "EDITOR");
  assert.deepEqual(await recipientTokens("NEW_BOOKING"), ["tok_e"]);
  assert.deepEqual(await recipientTokens("CONTENT_AWAITING_APPROVAL"), ["tok_e"]);
  assert.deepEqual(await recipientTokens("NEW_LEAD"), []);
});

test("SEO_MANAGER NEW_BOOKING defaults off, on with an enabled preference", async () => {
  addUser("s", "SEO_MANAGER");
  assert.deepEqual(await recipientTokens("NEW_BOOKING"), []);
  prefs.push({ userId: "s", event: "NEW_BOOKING", enabled: true });
  assert.deepEqual(await recipientTokens("NEW_BOOKING"), ["tok_s"]);
});

test("an ADMIN who turned NEW_LEAD off gets nothing", async () => {
  addUser("a", "ADMIN");
  prefs.push({ userId: "a", event: "NEW_LEAD", enabled: false });
  assert.deepEqual(await recipientTokens("NEW_LEAD"), []);
});

test("devices unseen for 30+ days are excluded and deleted", async () => {
  addUser("fresh", "ADMIN", "s1", ago(29 * DAY));
  addUser("stale", "ADMIN", "s2", ago(31 * DAY));
  assert.deepEqual(await recipientTokens("NEW_LEAD"), ["tok_fresh"]);
  assert.deepEqual(devices.map((d) => d.token), ["tok_fresh"]);
});

test("a device whose session was revoked gets nothing even if its row survived", async () => {
  addUser("a", "ADMIN");
  sessions[0].revokedAt = new Date();
  assert.deepEqual(await recipientTokens("NEW_LEAD"), []);
});

test("revoke deletes push devices for that session", async () => {
  addUser("a", "ADMIN", "s_a");
  devices.push({ id: "d2", userId: "a", adminSessionId: "s_other", token: "tok_other", lastSeenAt: new Date() });
  assert.equal(await revokeAdminSession("s_a", "a"), true);
  assert.deepEqual(devices.map((d) => d.token), ["tok_other"]);
});

test("revoking someone else's session deletes nothing", async () => {
  addUser("a", "ADMIN", "s_a");
  assert.equal(await revokeAdminSession("s_a", "intruder"), false);
  assert.equal(devices.length, 1);
});

test("revokeAllOther keeps the current session's device", async () => {
  addUser("a", "ADMIN", "s_keep");
  devices.push({ id: "d2", userId: "a", adminSessionId: "s_old", token: "tok_old", lastSeenAt: new Date() });
  sessions.push({ id: "s_old", userId: "a", revokedAt: null, lastSeenAt: new Date() });
  await revokeAllOtherAdminSessions("a", "s_keep");
  assert.deepEqual(devices.map((d) => d.token), ["tok_a"]);
});

test("revokeAllOther still removes other devices when the session update itself fails", async () => {
  addUser("a", "ADMIN", "s_keep");
  devices.push({ id: "d2", userId: "a", adminSessionId: "s_old", token: "tok_old", lastSeenAt: new Date() });
  failSessionUpdateMany = true;
  await assert.rejects(revokeAllOtherAdminSessions("a", "s_keep"));
  assert.deepEqual(devices.map((d) => d.token), ["tok_a"]);
});
