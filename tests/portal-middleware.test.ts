// Run with: npm test
//
// The route gate middleware.ts delegates to (lib/route-gate.ts): staff and
// client auth never satisfy each other's area, and /portal is never
// locale-rewritten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.CLIENT_SESSION_SECRET = "test-client-secret-0123456789abcdef0123456789";

const { decideGate, isLocaleExempt } = await import("@/lib/route-gate");
const { signClientSession, verifyClientSession } = await import("@/lib/portal/session-cookie");

const NOW = new Date("2026-11-22T10:00:00Z");
const staff = (role = "ADMIN") => ({ role });

async function clientValid(token: string | undefined, now = NOW) {
  return (await verifyClientSession(token, now)) !== null;
}

test("no client cookie at /portal/x redirects to /portal/login", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/projects", staffToken: null, hasClientSession: false }), { kind: "redirect", to: "/portal/login?from=%2Fportal%2Fprojects" });
  assert.deepEqual(decideGate({ pathname: "/portal", staffToken: null, hasClientSession: false }), { kind: "redirect", to: "/portal/login" });
});

test("invalid or expired client cookie redirects to /portal/login", async () => {
  const valid = await signClientSession({ sessionId: "s1", clientUserId: "cu1" }, NOW);
  assert.equal(await clientValid(valid), true);
  assert.equal(await clientValid(valid.slice(0, -3) + "abc"), false, "tampered");
  assert.equal(await clientValid("not-a-jwt"), false);
  const in91Days = new Date(NOW.getTime() + 91 * 24 * 60 * 60 * 1000);
  assert.equal(await clientValid(valid, in91Days), false, "expired");
  assert.deepEqual(decideGate({ pathname: "/portal/billing", staffToken: null, hasClientSession: false }), { kind: "redirect", to: "/portal/login?from=%2Fportal%2Fbilling" });
});

test("a valid client session opens /portal pages", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/projects/abc", staffToken: null, hasClientSession: true }), { kind: "next" });
});

test("valid client cookie at /admin redirects to /login (no staff token)", () => {
  const d = decideGate({ pathname: "/admin/clients", staffToken: null, hasClientSession: true });
  assert.equal(d.kind, "redirect");
  assert.ok(d.kind === "redirect" && d.to.startsWith("/login?from="));
});

test("a staff NextAuth token at /portal/x redirects to /portal/login", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/projects", staffToken: staff("SUPER_ADMIN"), hasClientSession: false }), { kind: "redirect", to: "/portal/login?from=%2Fportal%2Fprojects" });
});

test("a staff-secret JWT is not a valid client session", async () => {
  const staffSigned = await new SignJWT({ sid: "s1" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("u1")
    .setAudience("tbj-portal")
    .setIssuer("tbj-growth-tech")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("some-other-secret-0123456789abcdef0123"));
  assert.equal(await clientValid(staffSigned, new Date()), false);
});

test("/portal/login is open without a session", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/login", staffToken: null, hasClientSession: false }), { kind: "next" });
  assert.deepEqual(decideGate({ pathname: "/portal/login", staffToken: staff(), hasClientSession: false }), { kind: "next" });
});

test("/portal/login never redirects in middleware, even with a signed cookie (it may be revoked: no loop)", () => {
  // Middleware can only check the signature. A revoked or disabled session has
  // a valid signature for up to 90 days; bouncing it to /portal (which sends it
  // back here) would loop. The login page checks the database itself.
  assert.deepEqual(decideGate({ pathname: "/portal/login", staffToken: null, hasClientSession: true }), { kind: "next" });
});

test("/portal/signout is reachable with or without a session", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/signout", staffToken: null, hasClientSession: false }), { kind: "next" });
  assert.deepEqual(decideGate({ pathname: "/portal/signout", staffToken: null, hasClientSession: true }), { kind: "next" });
});

test("/portal is never locale-rewritten", () => {
  assert.equal(isLocaleExempt("/portal"), true);
  assert.equal(isLocaleExempt("/portal/login"), true);
  assert.equal(isLocaleExempt("/portal/projects/1"), true);
  assert.equal(isLocaleExempt("/portalx"), false);
  // Portal paths are decided by the gate, never fall through to the public (locale) branch.
  assert.notEqual(decideGate({ pathname: "/portal/x", staffToken: null, hasClientSession: true }).kind, "public");
});

test("a lookalike path such as /portalx is a public page, not the portal", () => {
  assert.deepEqual(decideGate({ pathname: "/portalx", staffToken: null, hasClientSession: false }), { kind: "public" });
});

test("staff admin gate is unchanged: no token -> /login?from=, unknown role -> AccessDenied, role prefixes", () => {
  assert.deepEqual(decideGate({ pathname: "/admin/posts", search: "?a=1", staffToken: null, hasClientSession: false }), { kind: "redirect", to: "/login?from=%2Fadmin%2Fposts%3Fa%3D1" });
  assert.deepEqual(decideGate({ pathname: "/admin", staffToken: { role: "CLIENT" }, hasClientSession: false }), { kind: "redirect", to: "/login?error=AccessDenied" });
  assert.deepEqual(decideGate({ pathname: "/admin/settings", staffToken: staff("EDITOR"), hasClientSession: false }), { kind: "redirect", to: "/admin?error=AdminOnly" });
  assert.deepEqual(decideGate({ pathname: "/admin/posts", staffToken: staff("SEO_MANAGER"), hasClientSession: false }), { kind: "redirect", to: "/admin?error=AccessDenied" });
  assert.deepEqual(decideGate({ pathname: "/admin/integrations", staffToken: staff("ADMIN"), hasClientSession: false }), { kind: "redirect", to: "/admin?error=SuperAdminOnly" });
  assert.deepEqual(decideGate({ pathname: "/admin/integrations", staffToken: staff("SUPER_ADMIN"), hasClientSession: false }), { kind: "next" });
  assert.deepEqual(decideGate({ pathname: "/login", staffToken: staff(), hasClientSession: false }), { kind: "redirect", to: "/admin" });
  assert.deepEqual(decideGate({ pathname: "/login", staffToken: null, hasClientSession: true }), { kind: "next" });
});

test("public pages pass through to the locale logic", () => {
  assert.deepEqual(decideGate({ pathname: "/services", staffToken: null, hasClientSession: false }), { kind: "public" });
});

test("/admin/clients: admins and editors may open it; contributors and SEO managers are turned away", () => {
  for (const role of ["SUPER_ADMIN", "ADMIN", "EDITOR"]) {
    assert.deepEqual(decideGate({ pathname: "/admin/clients/abc", staffToken: staff(role), hasClientSession: false }), { kind: "next" }, role);
  }
  assert.deepEqual(decideGate({ pathname: "/admin/clients", staffToken: staff("CONTRIBUTOR"), hasClientSession: false }), { kind: "redirect", to: "/admin?error=AccessDenied" });
  assert.deepEqual(decideGate({ pathname: "/admin/clients", staffToken: staff("SEO_MANAGER"), hasClientSession: false }), { kind: "redirect", to: "/admin?error=AccessDenied" });
});

test("a deep link without a session keeps where it was going (?from=, query included)", () => {
  assert.deepEqual(decideGate({ pathname: "/portal/projects/abc", search: "?tab=updates", staffToken: null, hasClientSession: false }), {
    kind: "redirect",
    to: "/portal/login?from=%2Fportal%2Fprojects%2Fabc%3Ftab%3Dupdates",
  });
});
