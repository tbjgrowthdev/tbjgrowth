// Client Hub session token: a signed (HS256) JWT in the tbj_client_session
// cookie. Edge-safe (jose + Web Crypto only, no Prisma), because middleware.ts
// verifies it too. Middleware can only check the signature and expiry; the
// ClientSession row (revocation, disabled user) is checked by requireClient()
// in lib/portal/auth.ts on every portal page and Server Action.
//
// Deliberately separate from staff auth: its own cookie, its own secret
// (CLIENT_SESSION_SECRET, never NEXTAUTH_SECRET) and its own audience, so a
// staff NextAuth token can never pass as a client session and vice versa.
import { SignJWT, jwtVerify } from "jose";

export const CLIENT_SESSION_COOKIE = "tbj_client_session";
export const CLIENT_SESSION_MAX_AGE_S = 90 * 24 * 60 * 60;

const ISSUER = "tbj-growth-tech";
const AUDIENCE = "tbj-portal";
const DEV_FALLBACK_SECRET = "client-session-dev-only-secret-replace-in-production";

let warnedAboutDevSecret = false;
let buildPlaceholder: string | undefined;

/**
 * Same policy as getNextAuthSecret() (lib/env.ts): required in production,
 * a warned fallback in development, a throwaway value during `next build`.
 */
export function getClientSessionSecret(): string {
  const secret = process.env.CLIENT_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    if (process.env.NEXT_PHASE === "phase-production-build") return (buildPlaceholder ??= crypto.randomUUID());
    throw new Error(
      "CLIENT_SESSION_SECRET is not set. Set it as a Worker runtime secret (random, 32+ bytes) before deploying the Client Hub."
    );
  }
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn("[portal] CLIENT_SESSION_SECRET is not set; using the development-only fallback secret.");
  }
  return DEV_FALLBACK_SECRET;
}

function key(): Uint8Array {
  return new TextEncoder().encode(getClientSessionSecret());
}

export type ClientSessionClaims = { sessionId: string; clientUserId: string };

export async function signClientSession(claims: ClientSessionClaims, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.clientUserId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + CLIENT_SESSION_MAX_AGE_S)
    .sign(key());
}

/** The claims of a valid, unexpired client token, or null for anything else. */
export async function verifyClientSession(token: string | undefined | null, now: Date = new Date()): Promise<ClientSessionClaims | null> {
  if (!token || typeof token !== "string") return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (typeof payload.sid !== "string" || typeof payload.sub !== "string" || !payload.sid || !payload.sub) return null;
    return { sessionId: payload.sid, clientUserId: payload.sub };
  } catch {
    return null;
  }
}

export function clientSessionCookieOptions() {
  return {
    httpOnly: true,
    // Browsers accept Secure cookies on http://localhost, so this holds in dev too.
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: CLIENT_SESSION_MAX_AGE_S,
  };
}
