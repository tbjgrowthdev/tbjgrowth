import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getRedirectMap } from "@/lib/redirect-cache";
import { ALL_ROLES } from "@/lib/permissions";
import { isKnownLocalePrefix } from "@/lib/i18n";

// Paths that live outside the app/(public)/[locale] tree entirely (standalone
// campaign landing pages, metadata routes) — never locale-rewritten/redirected.
const LOCALE_EXEMPT_PREFIXES = ["/landing-pages", "/robots.txt", "/sitemap.xml"];

/** Splits a known locale prefix ("en-bd", "bn-bd", "en-ae", "ar-ae") off the front of a path, if present. */
function stripLocalePrefix(pathname: string): { prefix: string | null; rest: string } {
  const [, maybePrefix, ...restSegments] = pathname.split("/");
  if (maybePrefix && isKnownLocalePrefix(maybePrefix)) {
    const rest = `/${restSegments.join("/")}`;
    return { prefix: maybePrefix, rest: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" };
  }
  return { prefix: null, rest: pathname };
}

export default withAuth(
  async function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // 1. DB-driven redirects apply to any path (checked before the admin auth
    //    gate), resolved against the de-prefixed path so a redirect set up
    //    before i18n existed still fires identically under every locale —
    //    the same prefix the request arrived with is re-applied to the
    //    destination.
    const { prefix: requestLocalePrefix, rest: unprefixedPathname } = stripLocalePrefix(pathname);
    const redirectMap = await getRedirectMap(req.url);
    const match = redirectMap.get(unprefixedPathname);
    if (match) {
      if (match.statusCode === 410) {
        // Gone — no Location header, just tells crawlers to deindex it now.
        return new NextResponse(null, { status: 410 });
      }
      const destination = requestLocalePrefix ? `/${requestLocalePrefix}${match.destination === "/" ? "" : match.destination}` : match.destination!;
      return NextResponse.redirect(new URL(destination, req.url), match.statusCode);
    }

    // 2. The auth gate below only concerns /admin and /login — every other path passes through.
    const isAdminPath = pathname.startsWith("/admin");
    const isAuthPage = pathname.startsWith("/login");

    if (!isAdminPath && !isAuthPage) {
      // 2a. Locale resolution for the public site. Exempt paths (standalone
      // landing pages, metadata routes) and anything already under a known
      // prefix pass straight through. "/en-gb/..." is redirected to its
      // unprefixed form (the default locale has exactly one canonical URL).
      // Anything else has no recognized prefix at all and is rewritten
      // (invisible to the browser) to "/en-gb/..." so it resolves against
      // app/(public)/[locale]/... with locale="en-gb" — see
      // lib/i18n.ts's resolveRouteLocale for why "en-gb" is the literal
      // internal param value for the default locale.
      const isExempt = LOCALE_EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      if (isExempt) {
        return NextResponse.next();
      }
      const firstSegment = pathname.split("/")[1];
      if (firstSegment?.toLowerCase() === "en-gb") {
        const stripped = pathname.replace(/^\/en-gb/i, "") || "/";
        return NextResponse.redirect(new URL(stripped, req.url), 308);
      }
      if (requestLocalePrefix) {
        return NextResponse.next();
      }
      return NextResponse.rewrite(new URL(`/en-gb${pathname === "/" ? "" : pathname}`, req.url));
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
    const seoPrefixes = ["/admin/redirects", "/admin/seo", "/admin/keywords", "/admin/link-monitor"];
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
  // The trailing `|.*\\..*` excludes any path with a file extension — every
  // static asset under /public (logos, og-images, fonts, manifest.json...)
  // — so those are served directly instead of being locale-rewritten to
  // "/en-gb/<file>", which doesn't exist and 404s.
  //
  // `runtime: "edge"` is required explicitly — Next 16 compiles the
  // deprecated "middleware.ts" convention as a Node.js function by default
  // now (omitting `runtime` does NOT fall back to Edge), and Cloudflare's
  // OpenNext adapter only supports Edge middleware (see
  // lib/redirect-cache.ts for how the Prisma-backed redirect lookup is kept
  // out of this file as a result).
  runtime: "experimental-edge",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\..*).*)"],
};
