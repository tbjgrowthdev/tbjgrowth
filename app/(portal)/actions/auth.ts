"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { issueLoginCode, normalizeEmail, verifyLoginCode as verifyCode, requireClient, revokeClientSession, ClientAuthError } from "@/lib/portal/auth";
import { CLIENT_SESSION_COOKIE, clientSessionCookieOptions } from "@/lib/portal/session-cookie";

// Client Hub sign-in (/portal/login). Both sign-in steps are public by
// nature; their protection is in lib/portal/auth.ts (invite-only, hashed
// codes, attempt and hourly limits, identical responses).

const emailSchema = z.object({ email: z.string().max(254) });
const verifySchema = z.object({ email: z.string().max(254), code: z.string().max(20) });

// The same object whatever happened, so the form can't be used to learn
// whether an email belongs to a client.
const CODE_REQUESTED = { success: true as const };
const SIGN_IN_FAILED = { success: false as const, error: "That code didn't work. Check it, or ask for a new one." };

// auth-check: public — step 1 of client sign-in; never reveals whether the email exists.
// Everything that depends on whether the email is a client's (lookup, rate
// limit, insert, Resend call) runs after the response (Next's after(), which
// Cloudflare maps to waitUntil), so response time can't reveal it either.
export async function requestLoginCode(data: { email: string }) {
  const parsed = emailSchema.safeParse(data);
  const email = parsed.success ? normalizeEmail(parsed.data.email) : null;
  if (email) {
    // Cloudflare's own header only: x-forwarded-for is client-controlled and
    // would let anyone pick which rate-limit bucket they land in.
    const ip = (await headers()).get("cf-connecting-ip");
    after(async () => {
      try {
        await issueLoginCode(email, new Date(), ip);
      } catch (error) {
        console.error("[portal] issueLoginCode failed:", error);
      }
    });
  }
  return CODE_REQUESTED;
}

// auth-check: public — step 2 of client sign-in; the code itself is the credential.
export async function verifyLoginCode(data: { email: string; code: string }) {
  try {
    const parsed = verifySchema.safeParse(data);
    if (!parsed.success) return SIGN_IN_FAILED;
    const h = await headers();
    const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const result = await verifyCode(parsed.data.email, parsed.data.code, { userAgent: h.get("user-agent"), ip });
    if (!result.ok) return SIGN_IN_FAILED;
    const jar = await cookies();
    jar.set(CLIENT_SESSION_COOKIE, result.token, clientSessionCookieOptions());
    return { success: true as const };
  } catch (error) {
    console.error("[portal] verifyLoginCode failed:", error);
    return SIGN_IN_FAILED;
  }
}

export async function signOutClient() {
  const jar = await cookies();
  try {
    const ctx = await requireClient();
    await revokeClientSession(ctx.sessionId);
  } catch (error) {
    // Already signed out or revoked: still clear the cookie below.
    if (!(error instanceof ClientAuthError)) console.error("[portal] signOutClient failed:", error);
  }
  jar.delete(CLIENT_SESSION_COOKIE);
  return { success: true as const };
}
