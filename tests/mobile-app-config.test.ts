// Run with: npm test
//
// lib/mobile-app.ts: where the public client-app APK link points.
import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";

mock.module("@opennextjs/cloudflare", { namedExports: { getCloudflareContext: () => ({ env: {} }) } });
const { getClientApk, DEFAULT_CLIENT_APK_URL } = await import("@/lib/mobile-app");

const saved = { url: process.env.NEXT_PUBLIC_ANDROID_APK_URL, version: process.env.NEXT_PUBLIC_ANDROID_APP_VERSION };
afterEach(() => {
  process.env.NEXT_PUBLIC_ANDROID_APK_URL = saved.url;
  process.env.NEXT_PUBLIC_ANDROID_APP_VERSION = saved.version;
  if (saved.url === undefined) delete process.env.NEXT_PUBLIC_ANDROID_APK_URL;
  if (saved.version === undefined) delete process.env.NEXT_PUBLIC_ANDROID_APP_VERSION;
});

test("getClientApk uses the default when env unset", () => {
  delete process.env.NEXT_PUBLIC_ANDROID_APK_URL;
  delete process.env.NEXT_PUBLIC_ANDROID_APP_VERSION;
  assert.equal(DEFAULT_CLIENT_APK_URL, "https://downloads.tbjgrowthtech.com/tbj-growth-tech.apk");
  assert.deepEqual(getClientApk(), { url: DEFAULT_CLIENT_APK_URL, version: null });
});

test("getClientApk uses an https env value and the version", () => {
  process.env.NEXT_PUBLIC_ANDROID_APK_URL = "https://downloads.tbjgrowthtech.com/tbj-growth-tech-1.0.1.apk";
  process.env.NEXT_PUBLIC_ANDROID_APP_VERSION = "1.0.1";
  assert.deepEqual(getClientApk(), { url: "https://downloads.tbjgrowthtech.com/tbj-growth-tech-1.0.1.apk", version: "1.0.1" });
});

test("getClientApk rejects a non-https env value", () => {
  for (const bad of ["http://downloads.tbjgrowthtech.com/a.apk", "javascript:alert(1)", "not a url", "/relative.apk"]) {
    process.env.NEXT_PUBLIC_ANDROID_APK_URL = bad;
    assert.equal(getClientApk().url, DEFAULT_CLIENT_APK_URL, bad);
  }
});
