import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { getRedirectMap } from "@/lib/redirect-cache";
import { isKnownLocalePrefix } from "@/lib/i18n";
import { getNextAuthSecret } from "@/lib/env";
import { decideGate, isLocaleExempt, isPortalPath } from "@/lib/route-gate";
import { CLIENT_SESSION_COOKIE, verifyClientSession } from "@/lib/portal/session-cookie";

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

    // 0. Client Hub (/portal): its own session cookie, never the staff token,
    //    never DB redirects or locale handling. See lib/route-gate.ts.
    if (isPortalPath(pathname)) {
      const hasClientSession = (await verifyClientSession(req.cookies.get(CLIENT_SESSION_COOKIE)?.value)) !== null;
      const decision = decideGate({ pathname, staffToken: null, hasClientSession });
      if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, req.url));
      return NextResponse.next();
    }

    // 1. DB-driven redirects apply to any path (checked before the admin auth
    //    gate), resolved against the de-prefixed path so a redirect set up
    //    before i18n existed still fires identically under every locale —
    //    the same prefix the request arrived with is re-applied to the
    //    destination.
    const isAdminPath = pathname.startsWith("/admin");
    const isAuthPage = pathname.startsWith("/login");

    const { prefix: requestLocalePrefix, rest: unprefixedPathname } = stripLocalePrefix(pathname);
    // Admin and login pages never need DB-driven redirects, so they skip the
    // redirect lookup entirely — otherwise every admin navigation and every
    // sidebar prefetch waited on that lookup before the page could start.
    const redirectMap = isAdminPath || isAuthPage ? null : await getRedirectMap(req.url);
    const match = redirectMap?.get(unprefixedPathname);
    if (match) {
      if (match.statusCode === 410) {
        // Gone — no Location header, just tells crawlers to deindex it now.
        return new NextResponse(null, { status: 410 });
      }
      const destination = requestLocalePrefix ? `/${requestLocalePrefix}${match.destination === "/" ? "" : match.destination}` : match.destination!;
      return NextResponse.redirect(new URL(destination, req.url), match.statusCode);
    }

    // 2. The auth gate below only concerns /admin and /login — every other path passes through.
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
      if (isLocaleExempt(pathname)) {
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

    // 3. Staff area (/admin, /login): the NextAuth token only; a client
    //    session cookie never counts here. Rules in lib/route-gate.ts.
    const decision = decideGate({ pathname, search: req.nextUrl.search, staffToken: req.nextauth.token, hasClientSession: false });
    if (decision.kind === "redirect") return NextResponse.redirect(new URL(decision.to, req.url));
    return NextResponse.next();
  },
  {
    // Same helper as lib/auth.ts's authOptions, so both always agree. Passed
    // explicitly because withAuth reads NEXTAUTH_SECRET separately from
    // authOptions and throws NO_SECRET if it can't see it in this execution
    // context. A getter, so it's resolved per request (see lib/env.ts).
    get secret() {
      return getNextAuthSecret();
    },
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
