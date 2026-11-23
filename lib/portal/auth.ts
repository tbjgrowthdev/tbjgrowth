// Client Hub authentication: invite-only, passwordless email codes and
// revocable sessions. Clients are ClientUser rows, never staff Users; nothing
// here reads or writes NextAuth state.
//
// Rules (docs/superpowers/plans/2026-11-22-client-hub.md, Global Constraints):
// - 6-digit code, only an HMAC of it is stored, 10-minute expiry, at most 5
//   guesses per code, at most 5 codes per email per hour.
// - The caller-visible result never depends on whether the email exists.
// - Sessions last 90 days and are rows in ClientSession; requireClient()
//   checks the row (revoked, disabled user) on every call.
//
// Neon HTTP (docs/known-limitations.md): no transactions and no updateMany.
// The two "claim" steps on a login code (use one guess, consume the code) are
// raw UPDATE … WHERE … RETURNING statements: one SQL statement is atomic in
// Postgres, whereas Prisma's update() with extra where conditions may read
// and then write without a transaction around them.
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { sendClientLoginCode } from "@/lib/email";
import {
  CLIENT_SESSION_COOKIE,
  getClientSessionSecret,
  signClientSession,
  verifyClientSession,
} from "@/lib/portal/session-cookie";

export type ClientLanguage = "en" | "bn";
export type ClientContext = { clientUserId: string; clientId: string; sessionId: string; language: ClientLanguage };

export class ClientAuthError extends Error {}

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
// Per (email, requesting IP), and an overall ceiling per email, so someone who
// knows a client's address can't use up that client's codes from one place.
export const MAX_CODES_PER_HOUR = 5;
export const MAX_CODES_PER_EMAIL_PER_HOUR = 15;
const HOUR_MS = 60 * 60 * 1000;
const CODE_RETENTION_MS = 24 * HOUR_MS;
// lastSeenAt is a "recently active" hint, not an audit trail: write it at most this often.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

function isP2025(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2025";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256(CLIENT_SESSION_SECRET, email + ":" + code), hex. Bound to the email so a hash can't be replayed for another address. */
export async function hashLoginCode(email: string, code: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(getClientSessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`${email}:${code}`)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Uniform 000000-999999 from the CSPRNG (rejection sampling avoids modulo bias). */
export function generateLoginCode(): string {
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return String(buf[0] % 1_000_000).padStart(6, "0");
  }
}

/**
 * Emails a sign-in code if `email` belongs to a client user who may sign in
 * and the hourly limit isn't reached. Returns nothing either way, so callers
 * can't tell the cases apart.
 */
export async function issueLoginCode(rawEmail: string, now: Date = new Date(), ip: string | null = null): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) return;

  const user = await prisma.clientUser.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") return;

  const issued = await createCodeWithinLimits(email, ip, now);
  if (!issued) return;
  await sendClientLoginCode({ to: email, code: issued.code, name: user.name, language: user.language });
}

/**
 * Stores a new code for `email` and returns it with its row id, or null if the hourly limits
 * are reached. Used by sign-in and by staff invites (ip null), so invites
 * count toward the same limits.
 *
 * Insert first, then count the rows that come before or with ours, and back
 * out if that's over the limit. A check-then-insert would let parallel
 * requests all pass; this fails closed under a race (Neon HTTP has no
 * transactions to lock with).
 */
export async function createCodeWithinLimits(email: string, ip: string | null, now: Date): Promise<{ code: string; id: string } | null> {
  const code = generateLoginCode();
  const mine = await prisma.clientLoginCode.create({
    data: { email, ip: ip?.slice(0, 100) ?? null, codeHash: await hashLoginCode(email, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), createdAt: now },
    select: { id: true, createdAt: true, ip: true },
  });
  const inWindowUpToMine = {
    email,
    createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
    OR: [{ createdAt: { lt: mine.createdAt } }, { createdAt: mine.createdAt, id: { lte: mine.id } }],
  };
  const fromThisIp = await prisma.clientLoginCode.count({ where: { ...inWindowUpToMine, ip: mine.ip } });
  const overall = fromThisIp > MAX_CODES_PER_HOUR ? 0 : await prisma.clientLoginCode.count({ where: inWindowUpToMine });
  if (fromThisIp > MAX_CODES_PER_HOUR || overall > MAX_CODES_PER_EMAIL_PER_HOUR) {
    await prisma.clientLoginCode.delete({ where: { id: mine.id } });
    return null;
  }
  // Housekeeping; a failure here must not stop the sign-in.
  try {
    await prisma.clientLoginCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - CODE_RETENTION_MS) } } });
  } catch (error) {
    console.error("[portal] login code cleanup failed:", error);
  }
  return { code, id: mine.id };
}

/** Withdraws a code that was never delivered (the email failed), so it doesn't use up the hourly limit. */
export async function withdrawLoginCode(id: string): Promise<void> {
  try {
    await prisma.clientLoginCode.delete({ where: { id } });
  } catch (error) {
    if (!isP2025(error)) throw error;
  }
}

/** Uses one of the code's guesses. False when the code is consumed or out of guesses. One statement, so parallel guesses can't exceed the limit. */
async function claimAttempt(id: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "ClientLoginCode" SET "attempts" = "attempts" + 1
    WHERE "id" = ${id} AND "consumedAt" IS NULL AND "attempts" < ${MAX_CODE_ATTEMPTS}
    RETURNING "id"`;
  return rows.length === 1;
}

/** Marks the code used. False when another request consumed it first. */
async function consumeCode(id: string, now: Date): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "ClientLoginCode" SET "consumedAt" = ${now}
    WHERE "id" = ${id} AND "consumedAt" IS NULL
    RETURNING "id"`;
  return rows.length === 1;
}

export type VerifyResult = { ok: true; token: string; sessionId: string } | { ok: false };

/**
 * Checks `code` against the newest unconsumed, unexpired code for `email`.
 * Every guess first claims one of the 5 attempts with one atomic UPDATE,
 * so even concurrent guesses can't exceed the limit. On success the code is
 * consumed (also one atomic UPDATE, so it can't be used twice) and a session is
 * created.
 */
export async function verifyLoginCode(
  rawEmail: string,
  rawCode: string,
  meta: { userAgent?: string | null; ip?: string | null },
  now: Date = new Date()
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = typeof rawCode === "string" ? rawCode.replace(/\s+/g, "") : "";
  if (!email || !/^\d{6}$/.test(code)) return { ok: false };

  const row = await prisma.clientLoginCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false };

  if (!(await claimAttempt(row.id))) return { ok: false };

  if (!constantTimeEqual(row.codeHash, await hashLoginCode(email, code))) return { ok: false };

  const user = await prisma.clientUser.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") return { ok: false };

  if (!(await consumeCode(row.id, now))) return { ok: false };

  const session = await prisma.clientSession.create({
    data: {
      clientUserId: user.id,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ip: meta.ip?.slice(0, 100) ?? null,
      createdAt: now,
      lastSeenAt: now,
    },
  });
  await prisma.clientUser.update({
    where: { id: user.id },
    data: { lastLoginAt: now, ...(user.status === "INVITED" ? { status: "ACTIVE" as const } : {}) },
  });

  return { ok: true, token: await signClientSession({ sessionId: session.id, clientUserId: user.id }, now), sessionId: session.id };
}

/** The ClientContext for a token, or null if the token, its session or its user is no longer valid. */
export async function getClientContextFromToken(token: string | undefined | null, now: Date = new Date()): Promise<ClientContext | null> {
  const claims = await verifyClientSession(token, now);
  if (!claims) return null;
  const session = await prisma.clientSession.findUnique({
    where: { id: claims.sessionId },
    select: {
      id: true,
      clientUserId: true,
      revokedAt: true,
      lastSeenAt: true,
      clientUser: { select: { id: true, clientId: true, status: true, language: true } },
    },
  });
  if (!session || session.revokedAt) return null;
  if (session.clientUserId !== claims.clientUserId || session.clientUser.status === "DISABLED") return null;

  if (now.getTime() - new Date(session.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    try {
      await prisma.clientSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    } catch (error) {
      console.error("[portal] session touch failed:", error);
    }
  }

  return {
    clientUserId: session.clientUser.id,
    // From the database, never from the request or the token.
    clientId: session.clientUser.clientId,
    sessionId: session.id,
    language: session.clientUser.language === "bn" ? "bn" : "en",
  };
}

/**
 * The signed-in client for this request. Throws ClientAuthError for a
 * missing, invalid, expired or revoked session or a disabled user. Every
 * portal page and Server Action calls it (directly or via
 * requireClientPage), and every portal data function takes its result.
 */
export async function requireClient(): Promise<ClientContext> {
  const jar = await cookies();
  const ctx = await getClientContextFromToken(jar.get(CLIENT_SESSION_COOKIE)?.value);
  if (!ctx) throw new ClientAuthError("Please sign in again.");
  return ctx;
}

export async function revokeClientSession(sessionId: string, now: Date = new Date()): Promise<void> {
  try {
    await prisma.clientSession.update({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now } });
  } catch (error) {
    if (!isP2025(error)) throw error;
  }
}

/** Signs a client user out everywhere (used when staff disable the user). One update per row: Neon HTTP can't run updateMany. */
export async function revokeAllClientSessions(clientUserId: string, now: Date = new Date()): Promise<number> {
  const open = await prisma.clientSession.findMany({ where: { clientUserId, revokedAt: null }, select: { id: true } });
  await Promise.all(open.map((s: { id: string }) => revokeClientSession(s.id, now)));
  return open.length;
}
