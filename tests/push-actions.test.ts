// Run with: npm test
//
// Server actions in app/(admin)/actions/push.ts: device registration from the
// TBJ Admin app and per-user notification preferences.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

type Device = { userId: string; adminSessionId: string | null; platform: string; token: string; lastSeenAt: Date };
type Pref = { userId: string; event: string; enabled: boolean };

let devices: Device[] = [];
let prefs: Pref[] = [];
let session: { user: { id: string; role: string; sessionId?: string } } | null = null;

class AuthError extends Error {}

const fakePrisma = {
  pushDevice: {
    async upsert({ where, create, update }: { where: { token: string }; create: Device; update: Partial<Device> }) {
      const existing = devices.find((d) => d.token === where.token);
      if (existing) return Object.assign(existing, update);
      devices.push({ ...create });
      return create;
    },
    async deleteMany({ where }: { where: { token: string; userId: string } }) {
      const before = devices.length;
      devices = devices.filter((d) => !(d.token === where.token && d.userId === where.userId));
      return { count: before - devices.length };
    },
  },
  pushPreference: {
    async findMany({ where }: { where: { userId: string } }) {
      return prefs.filter((p) => p.userId === where.userId);
    },
    async upsert({ where, create, update }: { where: { userId_event: { userId: string; event: string } }; create: Pref; update: Partial<Pref> }) {
      const k = where.userId_event;
      const existing = prefs.find((p) => p.userId === k.userId && p.event === k.event);
      if (existing) return Object.assign(existing, update);
      prefs.push({ ...create });
      return create;
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => {
      if (!session) throw new AuthError("Not authenticated");
      return session;
    },
  },
});

const { registerPushDevice, unregisterPushDevice, getPushPreferences, setPushPreference } = await import("../app/(admin)/actions/push");

beforeEach(() => {
  devices = [];
  prefs = [];
  session = { user: { id: "u_admin", role: "ADMIN", sessionId: "s1" } };
});

test("registerPushDevice stores the token against the current user and session", async () => {
  const result = await registerPushDevice({ token: "tok-1", platform: "android" });
  assert.deepEqual(result, { success: true });
  assert.equal(devices.length, 1);
  assert.deepEqual({ ...devices[0], lastSeenAt: undefined }, { userId: "u_admin", adminSessionId: "s1", platform: "android", token: "tok-1", lastSeenAt: undefined });
});

test("register re-assigns an existing token to the new user/session", async () => {
  await registerPushDevice({ token: "shared-phone", platform: "android" });
  session = { user: { id: "u_editor", role: "EDITOR", sessionId: "s2" } };
  await registerPushDevice({ token: "shared-phone", platform: "android" });
  assert.equal(devices.length, 1);
  assert.equal(devices[0].userId, "u_editor");
  assert.equal(devices[0].adminSessionId, "s2");
});

test("registerPushDevice rejects unauthenticated calls", async () => {
  session = null;
  const result = await registerPushDevice({ token: "tok-1", platform: "android" });
  assert.equal(result.success, false);
  assert.equal(devices.length, 0);
});

test("registerPushDevice rejects malformed input", async () => {
  for (const bad of [{ token: "", platform: "android" }, { token: "x".repeat(5000), platform: "android" }, { token: "t", platform: "ios" }, null]) {
    const result = await registerPushDevice(bad as never);
    assert.equal(result.success, false, JSON.stringify(bad)?.slice(0, 40));
  }
  assert.equal(devices.length, 0);
});

test("unregisterPushDevice only removes the caller's own token", async () => {
  devices.push({ userId: "someone_else", adminSessionId: "x", platform: "android", token: "theirs", lastSeenAt: new Date() });
  await registerPushDevice({ token: "mine", platform: "android" });
  await unregisterPushDevice("theirs");
  await unregisterPushDevice("mine");
  assert.deepEqual(devices.map((d) => d.token), ["theirs"]);
});

test("getPushPreferences lists only eligible events with role defaults and overrides", async () => {
  session = { user: { id: "u_editor", role: "EDITOR", sessionId: "s2" } };
  prefs.push({ userId: "u_editor", event: "NEW_BOOKING", enabled: false });
  const result = await getPushPreferences();
  assert.equal(result.success, true);
  assert.deepEqual(result.preferences, [
    { event: "NEW_BOOKING", enabled: false },
    { event: "CONTENT_AWAITING_APPROVAL", enabled: true },
  ]);
});

test("setPushPreference stores the choice", async () => {
  const result = await setPushPreference("NEW_LEAD", false);
  assert.deepEqual(result, { success: true });
  assert.deepEqual(prefs, [{ userId: "u_admin", event: "NEW_LEAD", enabled: false }]);
});

test("setPushPreference rejects ineligible event", async () => {
  session = { user: { id: "u_c", role: "CONTRIBUTOR", sessionId: "s3" } };
  const result = await setPushPreference("NEW_LEAD", true);
  assert.equal(result.success, false);
  assert.equal(prefs.length, 0);
  const bogus = await setPushPreference("DROP_TABLE" as never, true);
  assert.equal(bogus.success, false);
});
