import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getRedirectMap } from "@/lib/redirect-cache";
import { ALL_ROLES } from "@/lib/permissions";

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

    if (!token?.role || !(ALL_ROLES as string[]).includes(token.role)) {
      return NextResponse.redirect(new URL("/login?error=AccessDenied", req.url));
    }

    // Coarse, route-prefix-level gating for navigation only. The real
    // authorization is the per-permission check inside each server action
    // (lib/auth-guard.ts) — this just keeps roles from loading pages whose
    // every action they'd be denied anyway, for a cleaner UX.
    const role = token.role as string;
    const seoPrefixes = ["/admin/redirects", "/admin/seo", "/admin/keywords"];
    const adminOnlyPrefixes = ["/admin/settings", "/admin/admins", "/admin/leads", "/admin/integrations", "/admin/audit-log"];

    if (role === "SEO_MANAGER") {
      const allowed = seoPrefixes.some((p) => pathname.startsWith(p)) || pathname === "/admin" || pathname.startsWith("/admin/profile");
      if (!allowed) {
        return NextResponse.redirect(new URL("/admin?error=AccessDenied", req.url));
      }
    } else if (role === "CONTRIBUTOR") {
      const blocked = [...seoPrefixes, ...adminOnlyPrefixes].some((p) => pathname.startsWith(p));
      if (blocked) {
        return NextResponse.redirect(new URL("/admin?error=AccessDenied", req.url));
      }
    } else if (role === "EDITOR") {
      const blocked = [...seoPrefixes, ...adminOnlyPrefixes].some((p) => pathname.startsWith(p));
      if (blocked) {
        return NextResponse.redirect(new URL("/admin?error=AdminOnly", req.url));
      }
    } else if (role === "ADMIN") {
      if (pathname.startsWith("/admin/integrations")) {
        return NextResponse.redirect(new URL("/admin?error=SuperAdminOnly", req.url));
      }
    }
    // SUPER_ADMIN: unrestricted.

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
  runtime: "nodejs",
};
