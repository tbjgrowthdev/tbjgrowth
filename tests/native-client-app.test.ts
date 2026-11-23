// Run with: npm test
//
// The TBJ Growth Tech client app in app mode: telling it apart from TBJ
// Admin (lib/native.ts), which push each app may register, keeping it on
// /portal (lib/route-gate.ts), and where a push tap may go.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isClientApp, pushTargetFor, safeClientPushPath, ADMIN_APP_ID, CLIENT_APP_ID, CLIENT_UA_MARK } from "@/lib/native";
import { ADMIN_UA_MARK, shouldClientLockOnLoad } from "@/lib/native-lock";
import { decideGate } from "@/lib/route-gate";

const g = globalThis as { window?: unknown };
afterEach(() => {
  delete g.window;
});

const CLIENT_UA = `Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36 ${CLIENT_UA_MARK}`;
const ADMIN_UA = `Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36 ${ADMIN_UA_MARK}`;
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36";

test("isClientApp is true only with the TBJClientApp user agent", () => {
  assert.equal(isClientApp(CLIENT_UA), true);
  assert.equal(isClientApp(ADMIN_UA), false);
  assert.equal(isClientApp(BROWSER_UA), false);
  assert.equal(isClientApp(""), false);
  assert.equal(isClientApp(undefined), false);
});

test("client app never registers staff push and admin app never registers client push", () => {
  assert.equal(pushTargetFor({ appId: ADMIN_APP_ID, userAgent: ADMIN_UA }), "staff");
  assert.equal(pushTargetFor({ appId: CLIENT_APP_ID, userAgent: CLIENT_UA }), "client");
  // A mismatched pair (e.g. an old client APK without the UA mark) registers nothing.
  assert.equal(pushTargetFor({ appId: CLIENT_APP_ID, userAgent: BROWSER_UA }), null);
  assert.equal(pushTargetFor({ appId: ADMIN_APP_ID, userAgent: CLIENT_UA }), null);
  assert.equal(pushTargetFor({ appId: null, userAgent: CLIENT_UA }), null);
  assert.equal(pushTargetFor({ appId: "com.other", userAgent: CLIENT_UA }), null);
});

test("the two bridges only register their own push", () => {
  const admin = readFileSync("components/Admin/NativeAppBridge.tsx", "utf8");
  const client = readFileSync("components/Portal/ClientAppBridge.tsx", "utf8");
  assert.ok(admin.includes("registerPushDevice") && !admin.includes("registerClientPushDevice"));
  assert.ok(client.includes("registerClientPushDevice") && !/\bregisterPushDevice\b/.test(client));
  assert.match(admin, /pushTargetFor\(\{[^}]*\}\)\s*!==\s*"staff"/);
  assert.match(client, /pushTargetFor\(\{[^}]*\}\)\s*!==\s*"client"/);
});

test("middleware redirects the client app away from public pages but not from /portal or /api/portal", () => {
  const gate = (pathname: string, userAgent = CLIENT_UA) => decideGate({ pathname, staffToken: null, hasClientSession: true, userAgent });
  for (const p of ["/", "/en", "/en/services", "/blog/post", "/login", "/admin", "/book-a-call"]) {
    assert.deepEqual(gate(p), { kind: "redirect", to: "/portal" }, p);
  }
  for (const p of ["/portal", "/portal/projects/x", "/portal/login", "/api/portal/files/abc", "/api/anything"]) {
    assert.notDeepEqual(gate(p), { kind: "redirect", to: "/portal" }, p);
  }
  // Browsers and TBJ Admin are unaffected.
  assert.equal(gate("/en/services", BROWSER_UA).kind, "public");
  assert.notDeepEqual(gate("/admin", ADMIN_UA), { kind: "redirect", to: "/portal" });
});

test("safePortalPath is used for push navigation", () => {
  assert.equal(safeClientPushPath("/portal/billing"), "/portal/billing");
  for (const bad of ["/admin", "https://evil.test/portal", "//evil.test", "/portal/../admin", undefined, 42]) {
    assert.equal(safeClientPushPath(bad), "/portal", String(bad));
  }
  const bridge = readFileSync("components/Portal/ClientAppBridge.tsx", "utf8");
  assert.ok(bridge.includes("safeClientPushPath("));
});

test("the optional app lock starts locked only in the client app, when turned on, until unlocked", () => {
  assert.equal(shouldClientLockOnLoad(CLIENT_UA, "1", null), true);
  assert.equal(shouldClientLockOnLoad(CLIENT_UA, "1", "1"), false); // unlocked this app run
  assert.equal(shouldClientLockOnLoad(CLIENT_UA, null, null), false); // setting off (default)
  assert.equal(shouldClientLockOnLoad(BROWSER_UA, "1", null), false);
  assert.equal(shouldClientLockOnLoad(ADMIN_UA, "1", null), false);
});

test("the client flavor opens /portal with the TBJClientApp user agent; same package; version 1.1.0 (2)", () => {
  const flavors = readFileSync("mobile/scripts/flavor-configs.mjs", "utf8");
  assert.match(flavors, /client:\s*\{\s*appId:\s*"com\.tbjgrowthtech\.app"[^}]*url:\s*`\$\{ORIGIN\}\/portal`[^}]*appendUserAgent:\s*"TBJClientApp"/);
  const gradle = readFileSync("mobile/android/app/build.gradle", "utf8");
  assert.match(gradle, /versionCode 2\b/);
  assert.match(gradle, /versionName "1\.1\.0"/);
  assert.match(gradle, /applicationId "com\.tbjgrowthtech\.app"/);
  const manifest = readFileSync("mobile/android/app/src/client/AndroidManifest.xml", "utf8");
  assert.equal(/POST_NOTIFICATIONS"\s+tools:node="remove"/.test(manifest), false);
  assert.equal(/USE_BIOMETRIC"\s+tools:node="remove"/.test(manifest), false);
});
