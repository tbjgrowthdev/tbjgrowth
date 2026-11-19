// Run with: npm test
//
// GET /api/admin/app-download: the TBJ Admin APK, streamed from the private
// R2 bucket to signed-in admins only.
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

class AuthError extends Error {}

let authState: "ok" | "anonymous" | "revoked" = "ok";
let object: { body: ReadableStream; size: number; customMetadata?: Record<string, string> } | null = null;
let requestedKey: string | null = null;
const audits: Array<Record<string, unknown>> = [];

mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => {
      if (authState === "anonymous") throw new AuthError("Not authenticated");
      if (authState === "revoked") throw new AuthError("This session has been revoked. Please sign in again.");
      return { user: { id: "u1", role: "EDITOR" } };
    },
  },
});
mock.module("@opennextjs/cloudflare", {
  namedExports: {
    getCloudflareContext: () => ({
      env: {
        APP_BUILDS: {
          async get(key: string) {
            requestedKey = key;
            return object;
          },
          async head() {
            return object;
          },
        },
      },
    }),
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (e: Record<string, unknown>) => void audits.push(e) } });

const { GET } = await import("../app/api/admin/app-download/route");

function apkBody() {
  return new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("PK-fake-apk"));
      c.close();
    },
  });
}

beforeEach(() => {
  authState = "ok";
  object = { body: apkBody(), size: 11, customMetadata: { version: "1.0.0" } };
  requestedKey = null;
  audits.length = 0;
});

test("401 without session", async () => {
  authState = "anonymous";
  const res = await GET();
  assert.equal(res.status, 401);
  assert.equal(requestedKey, null, "never touches the bucket");
});

test("401 for revoked session", async () => {
  authState = "revoked";
  const res = await GET();
  assert.equal(res.status, 401);
  assert.equal(requestedKey, null);
});

test("404 when object missing", async () => {
  object = null;
  const res = await GET();
  assert.equal(res.status, 404);
});

test("200 streams with apk content-type, attachment disposition, no-store", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal(requestedKey, "tbj-admin.apk");
  assert.equal(res.headers.get("Content-Type"), "application/vnd.android.package-archive");
  assert.equal(res.headers.get("Content-Disposition"), 'attachment; filename="tbj-admin-1.0.0.apk"');
  assert.equal(res.headers.get("Cache-Control"), "private, no-store");
  assert.equal(res.headers.get("Content-Length"), "11");
  assert.equal(await res.text(), "PK-fake-apk");
  assert.equal(audits.length, 1);
});

test("missing or odd version metadata falls back to 'latest' in the filename", async () => {
  object = { body: apkBody(), size: 11, customMetadata: { version: '1.0"; evil' } };
  const res = await GET();
  assert.equal(res.headers.get("Content-Disposition"), 'attachment; filename="tbj-admin-latest.apk"');
});
