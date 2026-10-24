import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchGoogleUserEmail } from "@/lib/google-oauth";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

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

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const expectedState = req.cookies.get("google_oauth_state")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/admin/seo?google_error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/admin/seo?google_error=invalid_state", req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on first consent; if the admin previously
      // connected and revoked outside this app, they may need to revoke app access in
      // their Google account before reconnecting to force a fresh refresh_token.
      return NextResponse.redirect(new URL("/admin/seo?google_error=no_refresh_token", req.url));
    }

    const email = await fetchGoogleUserEmail(tokens.access_token);

    const existing = await prisma.googleIntegration.findFirst();
    const data = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
      connectedEmail: email,
    };

    if (existing) {
      await prisma.googleIntegration.update({ where: { id: existing.id }, data });
    } else {
      await prisma.googleIntegration.create({ data });
    }

    const response = NextResponse.redirect(new URL("/admin/seo?google_connected=1", req.url));
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/admin/seo?google_error=exchange_failed", req.url));
  }
}
