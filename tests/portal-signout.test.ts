// Run with: npm test
//
// /portal/signout (app/(portal)/portal/signout/route.ts): where a page sends a
// browser whose cookie is signed but whose session is no longer valid
// (revoked, disabled, deleted). It clears the cookie so /portal/login can
// render instead of looping. A still-valid session is left alone (a link
// someone else planted can't sign a client out).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

let validTokens = new Set<string>();
mock.module("@/lib/portal/auth", {
  namedExports: {
    getClientContextFromToken: async (token: string | undefined) =>
      token && validTokens.has(token) ? { clientUserId: "cu", clientId: "c", sessionId: "s", language: "en" } : null,
  },
});

const { GET } = await import("../app/(portal)/portal/signout/route");
const { CLIENT_SESSION_COOKIE } = await import("@/lib/portal/session-cookie");

function req(cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `${CLIENT_SESSION_COOKIE}=${cookie}`);
  return new NextRequest("https://tbjgrowthtech.com/portal/signout", { headers });
}

test("an invalid session's cookie is cleared and the browser goes to /portal/login", async () => {
  validTokens = new Set();
  const res = await GET(req("revoked-token"));
  assert.equal(res.status, 307);
  assert.equal(new URL(res.headers.get("location")!).pathname, "/portal/login");
  const setCookie = res.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(`${CLIENT_SESSION_COOKIE}=;`));
  assert.match(setCookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});

test("a valid session is not signed out by visiting the link", async () => {
  validTokens = new Set(["good"]);
  const res = await GET(req("good"));
  assert.equal(new URL(res.headers.get("location")!).pathname, "/portal");
  assert.equal(res.headers.get("set-cookie"), null);
});

test("no cookie goes straight to /portal/login", async () => {
  const res = await GET(req());
  assert.equal(new URL(res.headers.get("location")!).pathname, "/portal/login");
});
