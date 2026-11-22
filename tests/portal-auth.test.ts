// Run with: npm test
//
// Client Hub sign-in (lib/portal/auth.ts, app/(portal)/actions/auth.ts):
// invite-only, passwordless 6-digit email code, revocable 90-day session.
// Against a fake database, a fake mailer, a fake cookie jar and a fixed clock.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { decodeJwt, SignJWT } from "jose";

process.env.CLIENT_SESSION_SECRET = "test-client-secret-0123456789abcdef0123456789";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret-0123456789abcdef012345678";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;
type ClientUser = { id: string; clientId: string; email: string; name: string; language: "en" | "bn"; status: "INVITED" | "ACTIVE" | "DISABLED"; lastLoginAt: Date | null };
type Code = { id: string; email: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null; createdAt: Date };
type Session = { id: string; clientUserId: string; userAgent: string | null; ip: string | null; createdAt: Date; lastSeenAt: Date; revokedAt: Date | null };

let users: ClientUser[] = [];
let codes: Code[] = [];
let sessions: Session[] = [];
let sent: Array<{ to: string; code: string }> = [];
let cookieJar = new Map<string, string>();
let seq = 0;

class P2025 extends Error {
  code = "P2025";
}

function matches<T extends Record<string, unknown>>(row: T, where: Q): boolean {
  for (const [k, v] of Object.entries(where ?? {}) as Array<[string, Q]>) {
    if (k === "OR") {
      if (!(v as Q[]).some((w) => matches(row, w))) return false;
      continue;
    }
    const value = row[k];
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      if ("gte" in v && !((value as Date) >= v.gte)) return false;
      if ("lt" in v && !((value as number) < v.lt)) return false;
      if ("lte" in v && !((value as number) <= v.lte)) return false;
      if ("gt" in v && !((value as Date) > v.gt)) return false;
    } else if (v instanceof Date) {
      if (!(value instanceof Date) || value.getTime() !== v.getTime()) return false;
    } else if (value !== v) return false;
  }
  return true;
}

function applyData<T extends Record<string, unknown>>(row: T, data: Q): T {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === "object" && "increment" in (v as Q)) (row as Q)[k] = (row[k] as number) + (v as Q).increment;
    else (row as Q)[k] = v;
  }
  return row;
}

const fakePrisma = {
  clientUser: {
    async findUnique({ where }: Q) {
      return users.find((u) => (where.email ? u.email === where.email : u.id === where.id)) ?? null;
    },
    async update({ where, data }: Q) {
      const u = users.find((x) => x.id === where.id);
      if (!u) throw new P2025();
      return applyData(u, data);
    },
  },
  clientLoginCode: {
    async count({ where }: Q) {
      return codes.filter((c) => matches(c, where)).length;
    },
    async create({ data }: Q) {
      const row: Code = { id: `code_${++seq}`, attempts: 0, consumedAt: null, createdAt: data.createdAt ?? new Date(), ...data };
      codes.push(row);
      return row;
    },
    async findFirst({ where, orderBy }: Q) {
      const rows = codes.filter((c) => matches(c, where));
      if (orderBy?.createdAt === "desc") rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
      return rows[0] ?? null;
    },
    async update({ where, data }: Q) {
      const c = codes.find((x) => matches(x, where));
      if (!c) throw new P2025();
      return applyData(c, data);
    },
    async delete({ where }: Q) {
      const i = codes.findIndex((c) => c.id === where.id);
      if (i < 0) throw new P2025();
      return codes.splice(i, 1)[0];
    },
    async deleteMany({ where }: Q) {
      const before = codes.length;
      codes = codes.filter((c) => !(where.createdAt?.lt && c.createdAt < where.createdAt.lt));
      return { count: before - codes.length };
    },
  },
  clientSession: {
    async create({ data }: Q) {
      const row: Session = { id: `sess_${++seq}`, userAgent: null, ip: null, createdAt: new Date(), lastSeenAt: new Date(), revokedAt: null, ...data };
      sessions.push(row);
      return row;
    },
    async findUnique({ where }: Q) {
      const s = sessions.find((x) => x.id === where.id);
      if (!s) return null;
      const u = users.find((x) => x.id === s.clientUserId)!;
      return { ...s, clientUser: { id: u.id, clientId: u.clientId, status: u.status, language: u.language } };
    },
    async update({ where, data }: Q) {
      const s = sessions.find((x) => x.id === where.id);
      if (!s) throw new P2025();
      return applyData(s, data);
    },
    async findMany({ where }: Q) {
      return sessions.filter((s) => matches(s, where));
    },
  },
};

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/email", {
  namedExports: {
    sendClientLoginCode: async (p: { to: string; code: string }) => {
      sent.push({ to: p.to, code: p.code });
      return { success: true };
    },
    sendClientInvite: async () => ({ success: true }),
  },
});
let scheduled: Array<() => unknown> = [];
mock.module("next/server", { namedExports: { after: (fn: () => unknown) => void scheduled.push(fn) } });
async function flushScheduled() {
  const jobs = scheduled;
  scheduled = [];
  for (const job of jobs) await job();
}

mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
      set: (name: string, value: string) => void cookieJar.set(name, value),
      delete: (name: string) => void cookieJar.delete(name),
    }),
    headers: async () => new Headers({ "user-agent": "test-agent", "cf-connecting-ip": "203.0.113.9" }),
  },
});

const auth = await import("@/lib/portal/auth");
const { CLIENT_SESSION_COOKIE } = await import("@/lib/portal/session-cookie");
const actions = await import("../app/(portal)/actions/auth");

const NOW = new Date("2026-11-22T10:00:00Z");
const MIN = 60 * 1000;

function addUser(over: Partial<ClientUser> = {}): ClientUser {
  const u: ClientUser = { id: `cu_${++seq}`, clientId: "client_a", email: "owner@acme.test", name: "Owner", language: "en", status: "ACTIVE", lastLoginAt: null, ...over };
  users.push(u);
  return u;
}

async function signIn(email = "owner@acme.test") {
  await auth.issueLoginCode(email, NOW);
  const code = sent.at(-1)!.code;
  const result = await auth.verifyLoginCode(email, code, { userAgent: "ua", ip: "1.2.3.4" }, NOW);
  assert.equal(result.ok, true);
  return result as { ok: true; token: string; sessionId: string };
}

beforeEach(() => {
  users = [];
  codes = [];
  sessions = [];
  sent = [];
  cookieJar = new Map();
  scheduled = [];
});

test("issues a 6-digit code, stores only its hash, expires in 10 minutes", async () => {
  addUser();
  await auth.issueLoginCode("Owner@Acme.test ", NOW);
  assert.equal(sent.length, 1);
  const { code, to } = sent[0];
  assert.equal(to, "owner@acme.test");
  assert.match(code, /^\d{6}$/);
  assert.equal(codes.length, 1);
  assert.notEqual(codes[0].codeHash, code);
  assert.ok(!codes[0].codeHash.includes(code));
  assert.equal(codes[0].codeHash, await auth.hashLoginCode("owner@acme.test", code));
  assert.equal(codes[0].expiresAt.getTime(), NOW.getTime() + 10 * MIN);
});

test("an expired code is refused", async () => {
  addUser();
  await auth.issueLoginCode("owner@acme.test", NOW);
  const later = new Date(NOW.getTime() + 11 * MIN);
  const result = await auth.verifyLoginCode("owner@acme.test", sent[0].code, {}, later);
  assert.equal(result.ok, false);
});

test("wrong code 5 times locks the code", async () => {
  addUser();
  await auth.issueLoginCode("owner@acme.test", NOW);
  const right = sent[0].code;
  const wrong = right === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    assert.equal((await auth.verifyLoginCode("owner@acme.test", wrong, {}, NOW)).ok, false);
  }
  assert.equal((await auth.verifyLoginCode("owner@acme.test", right, {}, NOW)).ok, false);
  assert.equal(sessions.length, 0);
});

test("a consumed code cannot be reused", async () => {
  addUser();
  await auth.issueLoginCode("owner@acme.test", NOW);
  const code = sent[0].code;
  assert.equal((await auth.verifyLoginCode("owner@acme.test", code, {}, NOW)).ok, true);
  assert.equal((await auth.verifyLoginCode("owner@acme.test", code, {}, NOW)).ok, false);
  assert.equal(sessions.length, 1);
});

test("unknown email gets the same response and sends nothing", async () => {
  addUser();
  const known = await actions.requestLoginCode({ email: "owner@acme.test" });
  const unknown = await actions.requestLoginCode({ email: "nobody@else.test" });
  await flushScheduled();
  assert.deepEqual(unknown, known);
  assert.deepEqual(sent.map((s) => s.to), ["owner@acme.test"]);
  assert.equal(codes.filter((c) => c.email === "nobody@else.test").length, 0);
});

test("more than 5 codes per email per hour are refused without revealing why", async () => {
  addUser();
  const responses = [];
  for (let i = 0; i < 6; i++) responses.push(await actions.requestLoginCode({ email: "owner@acme.test" }));
  await flushScheduled();
  assert.equal(sent.length, 5);
  assert.deepEqual(responses[5], responses[0]);
});

test("the hourly limit resets after an hour", async () => {
  addUser();
  for (let i = 0; i < 5; i++) await auth.issueLoginCode("owner@acme.test", NOW);
  await auth.issueLoginCode("owner@acme.test", new Date(NOW.getTime() + 61 * MIN));
  assert.equal(sent.length, 6);
});

test("DISABLED client user cannot sign in", async () => {
  const u = addUser();
  await auth.issueLoginCode("owner@acme.test", NOW);
  const code = sent[0].code;
  u.status = "DISABLED";
  assert.equal((await auth.verifyLoginCode("owner@acme.test", code, {}, NOW)).ok, false);
  await auth.issueLoginCode("owner@acme.test", NOW);
  assert.equal(sent.length, 1, "no new code is sent to a disabled user");
});

test("verify creates a ClientSession and a 90-day JWT bound to its id", async () => {
  const u = addUser({ status: "INVITED" });
  const { token, sessionId } = await signIn();
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, sessionId);
  assert.equal(sessions[0].clientUserId, u.id);
  const claims = decodeJwt(token);
  assert.equal(claims.sid, sessionId);
  assert.equal(claims.sub, u.id);
  assert.equal((claims.exp as number) - (claims.iat as number), 90 * 24 * 60 * 60);
  assert.equal(u.status, "ACTIVE", "first sign-in activates an invited user");
  assert.ok(u.lastLoginAt);
});

test("requireClient returns the context for a valid session cookie", async () => {
  const u = addUser({ language: "bn" });
  const { token, sessionId } = await signIn();
  cookieJar.set(CLIENT_SESSION_COOKIE, token);
  const ctx = await auth.requireClient();
  assert.deepEqual(ctx, { clientUserId: u.id, clientId: "client_a", sessionId, language: "bn" });
});

test("requireClient rejects a missing cookie", async () => {
  await assert.rejects(auth.requireClient(), auth.ClientAuthError);
});

test("requireClient rejects a revoked session even with a valid JWT", async () => {
  addUser();
  const { token, sessionId } = await signIn();
  cookieJar.set(CLIENT_SESSION_COOKIE, token);
  await auth.revokeClientSession(sessionId);
  await assert.rejects(auth.requireClient(), auth.ClientAuthError);
});

test("requireClient rejects a session whose user was disabled", async () => {
  const u = addUser();
  const { token } = await signIn();
  cookieJar.set(CLIENT_SESSION_COOKIE, token);
  u.status = "DISABLED";
  await assert.rejects(auth.requireClient(), auth.ClientAuthError);
});

test("a staff NextAuth token is not accepted as a client session", async () => {
  addUser();
  const { sessionId } = await signIn();
  const { encode } = await import("next-auth/jwt");
  const staffToken = await encode({ token: { sub: "u_admin", role: "SUPER_ADMIN", sessionId, sid: sessionId }, secret: process.env.NEXTAUTH_SECRET! });
  cookieJar.set(CLIENT_SESSION_COOKIE, staffToken);
  await assert.rejects(auth.requireClient(), auth.ClientAuthError);
});

test("a JWT signed with another secret is not accepted even with a real session id", async () => {
  const u = addUser();
  const { sessionId } = await signIn();
  const forged = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(u.id)
    .setAudience("tbj-portal")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET));
  cookieJar.set(CLIENT_SESSION_COOKIE, forged);
  await assert.rejects(auth.requireClient(), auth.ClientAuthError);
});

test("verifyLoginCode action sets the session cookie; signOutClient revokes and clears it", async () => {
  addUser();
  await actions.requestLoginCode({ email: "owner@acme.test" });
  await flushScheduled();
  const result = await actions.verifyLoginCode({ email: "owner@acme.test", code: sent[0].code });
  assert.deepEqual(result, { success: true });
  assert.ok(cookieJar.get(CLIENT_SESSION_COOKIE));
  assert.equal(sessions[0].userAgent, "test-agent");
  await actions.signOutClient();
  assert.equal(cookieJar.has(CLIENT_SESSION_COOKIE), false);
  assert.ok(sessions[0].revokedAt);
});

test("verifyLoginCode action gives one generic error for every failure", async () => {
  addUser();
  const bad = await actions.verifyLoginCode({ email: "owner@acme.test", code: "123456" });
  const unknown = await actions.verifyLoginCode({ email: "nobody@else.test", code: "123456" });
  const malformed = await actions.verifyLoginCode({ email: "owner@acme.test", code: "12" });
  assert.equal(bad.success, false);
  assert.deepEqual(unknown, bad);
  assert.deepEqual(malformed, bad);
});

test("requestLoginCode answers before any lookup or email (no timing difference between known and unknown emails)", async () => {
  addUser();
  let lookups = 0;
  const original = fakePrisma.clientUser.findUnique;
  fakePrisma.clientUser.findUnique = async (args: Q) => {
    lookups++;
    return original(args);
  };
  try {
    await actions.requestLoginCode({ email: "owner@acme.test" });
    assert.equal(lookups, 0, "no database lookup before the response");
    assert.equal(sent.length, 0, "no email before the response");
    assert.equal(scheduled.length, 1);
    await flushScheduled();
    assert.equal(sent.length, 1, "the code is sent after the response");
  } finally {
    fakePrisma.clientUser.findUnique = original;
  }
});

test("a malformed email schedules nothing", async () => {
  await actions.requestLoginCode({ email: "not-an-email" });
  assert.equal(scheduled.length, 0);
});

test("the hourly limit holds under parallel requests", async () => {
  addUser();
  await Promise.all(Array.from({ length: 8 }, () => auth.issueLoginCode("owner@acme.test", NOW)));
  assert.equal(sent.length, 5);
  assert.equal(codes.length, 5, "over-limit rows are removed again");
});
