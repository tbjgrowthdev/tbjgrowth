// Run with: npm test
//
// lib/push/fcm.ts against a fake fetch: the OAuth exchange (service-account
// JWT signed with WebCrypto), one FCM HTTP v1 request per token, and how dead
// tokens are reported back for deletion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { createFcmSender } from "@/lib/push/fcm";
import { PUSH_MESSAGES } from "@/lib/push/messages";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicKey = createPublicKey(privateKey);

const serviceAccountJson = JSON.stringify({
  type: "service_account",
  project_id: "tbj-test",
  client_email: "push@tbj-test.iam.gserviceaccount.com",
  private_key: privatePem,
  token_uri: "https://oauth2.googleapis.com/token",
});

type Call = { url: string; init: RequestInit };

function fakeFetch(fcmStatusFor: (token: string) => { status: number; body?: unknown } = () => ({ status: 200 })) {
  const calls: Call[] = [];
  const fn = (async (url: string | URL, init: RequestInit = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: `at-${calls.length}`, expires_in: 3600 }), { status: 200 });
    }
    const token = JSON.parse(String(init.body)).message.token as string;
    const r = fcmStatusFor(token);
    return new Response(JSON.stringify(r.body ?? { name: "projects/tbj-test/messages/1" }), { status: r.status });
  }) as typeof fetch;
  return { fn, calls };
}

const msg = PUSH_MESSAGES.NEW_LEAD;

test("signs an RS256 JWT and exchanges it at oauth2.googleapis.com/token once, reusing the access token until 60s before expiry", async () => {
  let now = 1_700_000_000_000;
  const f = fakeFetch();
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: () => now });

  await sender.send(["t1"], msg);
  await sender.send(["t2"], msg);
  const tokenCalls = () => f.calls.filter((c) => c.url === "https://oauth2.googleapis.com/token");
  assert.equal(tokenCalls().length, 1, "second send reuses the cached access token");

  const form = new URLSearchParams(String(tokenCalls()[0].init.body));
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [h, p, s] = form.get("assertion")!.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(claims.iss, "push@tbj-test.iam.gserviceaccount.com");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, "base64url")), "signature verifies");

  now += (3600 - 59) * 1000; // inside the 60s refresh margin
  await sender.send(["t3"], msg);
  assert.equal(tokenCalls().length, 2, "refreshes near expiry");
});

test("posts one message per token to https://fcm.googleapis.com/v1/projects/{project_id}/messages:send with notification {title, body} and data {url}", async () => {
  const f = fakeFetch();
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: () => 1_700_000_000_000 });
  const result = await sender.send(["a", "b"], msg);

  const sends = f.calls.filter((c) => c.url.startsWith("https://fcm.googleapis.com/"));
  assert.equal(sends.length, 2);
  for (const c of sends) {
    assert.equal(c.url, "https://fcm.googleapis.com/v1/projects/tbj-test/messages:send");
    assert.equal((c.init.headers as Record<string, string>).Authorization, "Bearer at-1");
    const body = JSON.parse(String(c.init.body)).message;
    assert.deepEqual(body.notification, { title: "New lead received", body: "Open the admin panel to view it." });
    assert.deepEqual(body.data, { url: "/admin/leads" });
    assert.equal(body.android.priority, "high");
  }
  assert.deepEqual(sends.map((c) => JSON.parse(String(c.init.body)).message.token).sort(), ["a", "b"]);
  assert.deepEqual(result, { sent: 2, invalidTokens: [] });
});

test("unregistered token is reported for deletion", async () => {
  const f = fakeFetch((token) => {
    if (token === "gone") return { status: 404, body: { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } } };
    if (token === "bad") return { status: 400, body: { error: { status: "INVALID_ARGUMENT" } } };
    if (token === "flaky") return { status: 503, body: { error: { status: "UNAVAILABLE" } } };
    return { status: 200 };
  });
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: () => 1_700_000_000_000 });
  const result = await sender.send(["ok", "gone", "bad", "flaky"], msg);
  assert.equal(result.sent, 1);
  // Only UNREGISTERED means the token is dead. INVALID_ARGUMENT can be our own
  // malformed message, and a 503 is temporary.
  assert.deepEqual(result.invalidTokens, ["gone"]);
});

test("a sender misconfiguration never deletes devices", async () => {
  // Wrong Firebase project / service account: every send fails the same way.
  const f = fakeFetch(() => ({ status: 403, body: { error: { status: "PERMISSION_DENIED", details: [{ errorCode: "SENDER_ID_MISMATCH" }] } } }));
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: () => 1_700_000_000_000 });
  const result = await sender.send(["a", "b"], msg);
  assert.deepEqual(result, { sent: 0, invalidTokens: [] });
});

test("a bare 404 without UNREGISTERED detail is not treated as dead", async () => {
  const f = fakeFetch(() => ({ status: 404, body: { error: { status: "NOT_FOUND" } } }));
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: () => 1_700_000_000_000 });
  assert.deepEqual((await sender.send(["a"], msg)).invalidTokens, []);
});

test("missing FCM_SERVICE_ACCOUNT_JSON returns {sent:0} without fetching", async () => {
  const f = fakeFetch();
  const sender = createFcmSender({ serviceAccountJson: undefined, fetch: f.fn, now: Date.now });
  assert.deepEqual(await sender.send(["a"], msg), { sent: 0, invalidTokens: [] });
  assert.equal(f.calls.length, 0);
});

test("no tokens means no network calls", async () => {
  const f = fakeFetch();
  const sender = createFcmSender({ serviceAccountJson, fetch: f.fn, now: Date.now });
  assert.deepEqual(await sender.send([], msg), { sent: 0, invalidTokens: [] });
  assert.equal(f.calls.length, 0);
});

test("push copy never carries personal data placeholders", () => {
  for (const m of Object.values(PUSH_MESSAGES)) {
    assert.ok(m.url.startsWith("/admin"), m.url);
    assert.doesNotMatch(`${m.title} ${m.body}`, /\{|\$|@/);
  }
});
