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
// Neon HTTP (docs/known-limitations.md): no transactions and no updateMany,
// so the "claim" steps are single conditional update() calls that throw
// P2025 when the condition no longer holds.
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
export const MAX_CODES_PER_HOUR = 5;
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
export async function issueLoginCode(rawEmail: string, now: Date = new Date()): Promise<void> {
  const email = normalizeEmail(rawEmail);
  if (!email) return;

  const user = await prisma.clientUser.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") return;

  const recent = await prisma.clientLoginCode.count({ where: { email, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } });
  if (recent >= MAX_CODES_PER_HOUR) return;

  const code = generateLoginCode();
  await prisma.clientLoginCode.create({
    data: { email, codeHash: await hashLoginCode(email, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), createdAt: now },
  });
  // Housekeeping; a failure here must not stop the sign-in.
  try {
    await prisma.clientLoginCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - CODE_RETENTION_MS) } } });
  } catch (error) {
    console.error("[portal] login code cleanup failed:", error);
  }
  await sendClientLoginCode({ to: email, code, name: user.name, language: user.language });
}

export type VerifyResult = { ok: true; token: string; sessionId: string } | { ok: false };

/**
 * Checks `code` against the newest unconsumed, unexpired code for `email`.
 * Every guess first claims one of the 5 attempts with a conditional update,
 * so even concurrent guesses can't exceed the limit. On success the code is
 * consumed (also conditionally, so it can't be used twice) and a session is
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

  try {
    await prisma.clientLoginCode.update({
      where: { id: row.id, consumedAt: null, attempts: { lt: MAX_CODE_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
  } catch (error) {
    if (isP2025(error)) return { ok: false };
    throw error;
  }

  if (!constantTimeEqual(row.codeHash, await hashLoginCode(email, code))) return { ok: false };

  const user = await prisma.clientUser.findUnique({ where: { email } });
  if (!user || user.status === "DISABLED") return { ok: false };

  try {
    await prisma.clientLoginCode.update({ where: { id: row.id, consumedAt: null }, data: { consumedAt: now } });
  } catch (error) {
    if (isP2025(error)) return { ok: false };
    throw error;
  }

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
