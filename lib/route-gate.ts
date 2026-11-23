// Pure route-gate decision for middleware.ts (Edge-safe, no I/O), so the
// rules can be unit-tested (tests/portal-middleware.test.ts).
//
// Two areas with two separate identities that never satisfy each other:
// - /admin and /login: the staff NextAuth token only.
// - /portal: the client session cookie only (lib/portal/session-cookie.ts).
//   middleware can verify its signature and expiry; requireClient() checks
//   revocation on every page and Server Action.
import { ALL_ROLES } from "@/lib/permissions";

// Paths that live outside the app/(public)/[locale] tree entirely (standalone
// campaign landing pages, metadata routes, the Client Hub): never
// locale-rewritten or redirected.
export const LOCALE_EXEMPT_PREFIXES = ["/landing-pages", "/robots.txt", "/sitemap.xml", "/portal"];

export function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isLocaleExempt(pathname: string): boolean {
  return LOCALE_EXEMPT_PREFIXES.some((p) => isUnder(pathname, p));
}

export function isPortalPath(pathname: string): boolean {
  return isUnder(pathname, "/portal");
}

export type GateInput = {
  pathname: string;
  search?: string;
  /** The decoded staff NextAuth token, if any. */
  staffToken: { role?: unknown } | null | undefined;
  /** A client session cookie with a valid signature that hasn't expired. */
  hasClientSession: boolean;
};

export type GateDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  /** Not a gated area: continue with redirects and locale handling. */
  | { kind: "public" };

const NEXT: GateDecision = { kind: "next" };
const redirect = (to: string): GateDecision => ({ kind: "redirect", to });

const SEO_PREFIXES = ["/admin/redirects", "/admin/seo", "/admin/keywords", "/admin/link-monitor"];
const ADMIN_ONLY_PREFIXES = ["/admin/settings", "/admin/admins", "/admin/leads", "/admin/subscribers", "/admin/integrations", "/admin/audit-log"];
// Client Hub admin: CLIENT_MANAGEMENT / CLIENT_UPDATES (admins and editors).
const CLIENT_HUB_PREFIXES = ["/admin/clients"];

export function decideGate({ pathname, search = "", staffToken, hasClientSession }: GateInput): GateDecision {
  // Client Hub. A staff token is ignored here on purpose.
  if (isPortalPath(pathname)) {
    // Always open: middleware only knows the signature, and a revoked session
    // still has a valid one. Sending it to /portal would bounce it straight
    // back here (redirect loop). The login page checks the database itself;
    // /portal/signout clears a dead cookie.
    if (isUnder(pathname, "/portal/login") || isUnder(pathname, "/portal/signout")) return NEXT;
    if (hasClientSession) return NEXT;
    // Keep where they were going (e.g. a push tap with an expired session);
    // the login page only follows it through safePortalPath().
    const target = pathname + search;
    return redirect(target === "/portal" ? "/portal/login" : `/portal/login?from=${encodeURIComponent(target)}`);
  }

  const isAdminPath = pathname.startsWith("/admin");
  const isAuthPage = pathname.startsWith("/login");
  if (!isAdminPath && !isAuthPage) return { kind: "public" };

  // From here on only the staff token counts; a client cookie is ignored.
  const isAuth = !!staffToken;
  if (isAuthPage) return isAuth ? redirect("/admin") : NEXT;

  if (!isAuth) return redirect(`/login?from=${encodeURIComponent(pathname + search)}`);

  const role = staffToken?.role;
  if (typeof role !== "string" || !(ALL_ROLES as string[]).includes(role)) {
    return redirect("/login?error=AccessDenied");
  }

  // Coarse, route-prefix-level gating for navigation only. The real
  // authorization is the per-permission check inside each server action
  // (lib/auth-guard.ts) — this just keeps roles from loading pages whose
  // every action they'd be denied anyway, for a cleaner UX.
  if (role === "SEO_MANAGER") {
    const allowed =
      SEO_PREFIXES.some((p) => pathname.startsWith(p)) ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/profile") ||
      // The TBJ Admin app download page is for every role.
      pathname === "/admin/app";
    if (!allowed) return redirect("/admin?error=AccessDenied");
  } else if (role === "CONTRIBUTOR") {
    if ([...SEO_PREFIXES, ...ADMIN_ONLY_PREFIXES, ...CLIENT_HUB_PREFIXES].some((p) => pathname.startsWith(p))) return redirect("/admin?error=AccessDenied");
  } else if (role === "EDITOR") {
    if ([...SEO_PREFIXES, ...ADMIN_ONLY_PREFIXES].some((p) => pathname.startsWith(p))) return redirect("/admin?error=AdminOnly");
  } else if (role === "ADMIN") {
    if (pathname.startsWith("/admin/integrations")) return redirect("/admin?error=SuperAdminOnly");
  }
  // SUPER_ADMIN: unrestricted.
  return NEXT;
}
