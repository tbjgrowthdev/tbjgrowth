import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getRedirectMap } from "@/lib/redirect-cache";

export default withAuth(
  async function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // 1. DB-driven redirects apply to any path (checked before the admin auth gate).
    const redirectMap = await getRedirectMap();
    const match = redirectMap.get(pathname);
    if (match) {
      return NextResponse.redirect(new URL(match.destination, req.url), match.permanent ? 308 : 307);
    }

    // 2. The auth gate below only concerns /admin and /login — every other path passes through.
    const isAdminPath = pathname.startsWith("/admin");
    const isAuthPage = pathname.startsWith("/login");

    if (!isAdminPath && !isAuthPage) {
      return NextResponse.next();
    }

    const token = req.nextauth.token;
    const isAuth = !!token;

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.next();
    }

    if (!isAuth) {
      let from = pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }

    if (token?.role !== "ADMIN" && token?.role !== "EDITOR") {
      return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
    }

    // Editors get content-management access only; these prefixes are technical/
    // sensitive areas reserved for Admins.
    const adminOnlyPrefixes = ["/admin/settings", "/admin/redirects", "/admin/seo", "/admin/keywords", "/admin/admins", "/admin/leads"];
    if (token?.role === "EDITOR" && adminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL("/admin?error=AdminOnly", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      async authorized() {
        // We handle all path-scoping ourselves in the middleware function above,
        // so this always returns true and lets the function run for every matched path.
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
  runtime: "experimental-edge",
};
