// Run with: npm test
//
// Loads the real public/sw.js in a vm sandbox and checks its routing policy:
// admin, login, api, non-GET and cross-origin requests must never be touched
// by the service worker, so nothing private ends up in Cache Storage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://tbjgrowthtech.com";

type Policy = (url: URL, method: string, origin: string) => "bypass" | "static" | "page";

function loadPolicy(): Policy {
  const self: Record<string, unknown> = {
    location: { origin: ORIGIN },
    addEventListener() {},
  };
  const sandbox = { self, caches: {}, fetch() {}, URL, Response: class {} };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), sandbox);
  const policy = self.__cachePolicy as Policy | undefined;
  assert.equal(typeof policy, "function", "sw.js must expose self.__cachePolicy");
  return policy!;
}

const at = (path: string) => new URL(path, ORIGIN);

test('cachePolicy returns "bypass" for admin, login, api, POST, cross-origin', () => {
  const policy = loadPolicy();
  for (const path of ["/admin", "/admin/leads", "/admin/app", "/login?from=x", "/api/auth/session", "/api/admin/app-download"]) {
    assert.equal(policy(at(path), "GET", ORIGIN), "bypass", path);
  }
  assert.equal(policy(at("/"), "POST", ORIGIN), "bypass", "POST");
  assert.equal(policy(new URL("https://www.google.com/x"), "GET", ORIGIN), "bypass", "cross-origin");
});

test('cachePolicy does not treat "/administrator-guide" as admin-only prefix collision', () => {
  // Only the /admin segment is private; a public slug that merely starts
  // with the same letters is a normal page.
  const policy = loadPolicy();
  assert.equal(policy(at("/administrator-guide"), "GET", ORIGIN), "page");
});

test('cachePolicy returns "static" for build assets and images', () => {
  const policy = loadPolicy();
  for (const path of ["/_next/static/chunks/a.js", "/icons/icon-192.png", "/primarylogo.png", "/fonts/x.woff2"]) {
    assert.equal(policy(at(path), "GET", ORIGIN), "static", path);
  }
});

test('cachePolicy returns "page" for public pages under every locale', () => {
  const policy = loadPolicy();
  for (const path of ["/", "/bn-bd/services/seo", "/ar-ae", "/blog/hello", "/app"]) {
    assert.equal(policy(at(path), "GET", ORIGIN), "page", path);
  }
});
