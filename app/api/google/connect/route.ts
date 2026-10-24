import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-oauth";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  // Same permission as the rest of Google integration management
  // (app/(admin)/actions/google.ts) — SUPER_ADMIN-only, not a plain ADMIN
  // check (see lib/permissions.ts's comment on INTEGRATION_MANAGEMENT).
  try {
    await requirePermission("INTEGRATION_MANAGEMENT");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    throw error;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = getGoogleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });
  return response;
}
