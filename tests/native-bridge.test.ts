// Run with: npm test
//
// lib/native.ts: detecting the Capacitor shell, telling the TBJ Admin app
// apart from the client app, and keeping a push notification's tap target
// inside /admin on this origin.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isNativeApp, isAdminApp, safeAdminPath, ADMIN_APP_ID } from "@/lib/native";

const g = globalThis as { window?: unknown };

function fakeShell(appId: string | null) {
  g.window = {
    location: { origin: "https://tbjgrowthtech.com" },
    Capacitor: {
      isNativePlatform: () => true,
      Plugins: appId ? { App: { getInfo: async () => ({ id: appId }) } } : {},
    },
  };
}

afterEach(() => {
  delete g.window;
});

test("safeAdminPath keeps same-origin /admin paths", () => {
  fakeShell(ADMIN_APP_ID);
  assert.equal(safeAdminPath("/admin/leads"), "/admin/leads");
  assert.equal(safeAdminPath("/admin/posts/abc?tab=review"), "/admin/posts/abc?tab=review");
  assert.equal(safeAdminPath("/admin"), "/admin");
});

test("safeAdminPath falls back to /admin for anything else", () => {
  fakeShell(ADMIN_APP_ID);
  for (const bad of ["https://evil.com/admin", "//evil.com", "/\\evil.com", "/login", "/administrator", "javascript:alert(1)", undefined, null, 42, ""]) {
    assert.equal(safeAdminPath(bad), "/admin", String(bad));
  }
});

test("isNativeApp is false without window.Capacitor", () => {
  assert.equal(isNativeApp(), false);
  g.window = {};
  assert.equal(isNativeApp(), false);
});

test("isNativeApp is true inside the Capacitor shell", () => {
  fakeShell(ADMIN_APP_ID);
  assert.equal(isNativeApp(), true);
});

test("isAdminApp is true only for com.tbjgrowthtech.admin", async () => {
  fakeShell("com.tbjgrowthtech.admin");
  assert.equal(await isAdminApp(), true);
  fakeShell("com.tbjgrowthtech.app");
  assert.equal(await isAdminApp(), false);
  fakeShell(null);
  assert.equal(await isAdminApp(), false);
  delete g.window;
  assert.equal(await isAdminApp(), false);
});
