// Run with: npm test
//
// Drives every exported Server Action in app/(admin)/actions/ai-settings.ts
// against an in-memory fake database and asserts the API key never appears
// in any action response, audit-log entry, stored metadata, or console output.
import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const ADMIN_SECRET = "xai-ADMINSECRET-0123456789abcdefQRST";
const ENV_SECRET = "sk-ENVSECRET-9876543210fedcbaLMNO";

type Row = Record<string, unknown> & { id: string; provider: string };
const integrations = new Map<string, Row>();
let aiSettings: Record<string, unknown> | null = null;
const auditEntries: unknown[] = [];
const consoleOutput: string[] = [];
let nextId = 1;

function pick(row: Row | null | undefined) {
  return row ? { ...row } : null;
}

const fakePrisma = {
  integration: {
    async findUnique({ where }: { where: { provider: string } }) {
      return pick(integrations.get(where.provider));
    },
    async findMany({ where }: { where?: { provider?: { in?: string[] } } } = {}) {
      const wanted = where?.provider?.in;
      return [...integrations.values()].filter((r) => !wanted || wanted.includes(r.provider)).map((r) => ({ ...r }));
    },
    async upsert({ where, create, update }: { where: { provider: string }; create: Record<string, unknown>; update: Record<string, unknown> }) {
      const existing = integrations.get(where.provider);
      const now = new Date();
      const row: Row = existing
        ? { ...existing, ...update, updatedAt: now }
        : { id: `int_${nextId++}`, lastError: null, lastCheckedAt: null, metadata: null, createdAt: now, ...create, provider: where.provider, updatedAt: now };
      integrations.set(where.provider, row);
      return { ...row };
    },
    async update({ where, data }: { where: { provider: string }; data: Record<string, unknown> }) {
      const existing = integrations.get(where.provider);
      if (!existing) throw new Error("Record not found");
      const row = { ...existing, ...data, updatedAt: new Date() };
      integrations.set(where.provider, row);
      return { ...row };
    },
    async delete({ where }: { where: { provider: string } }) {
      const existing = integrations.get(where.provider);
      integrations.delete(where.provider);
      return existing;
    },
  },
  aiSettings: {
    async findUnique() {
      return aiSettings ? { ...aiSettings } : null;
    },
    async upsert({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) {
      aiSettings = { ...(aiSettings ?? create), ...update, updatedAt: new Date() };
      return aiSettings;
    },
  },
};

class AuthError extends Error {}

mock.module("@/lib/prisma", { namedExports: { prisma: fakePrisma }, defaultExport: fakePrisma });
mock.module("@/lib/auth-guard", {
  namedExports: {
    AuthError,
    requireSession: async () => ({ user: { id: "user_1", role: "SUPER_ADMIN" } }),
    requirePermission: async () => ({ user: { id: "user_1", role: "SUPER_ADMIN" } }),
  },
});
mock.module("@/lib/audit-log", { namedExports: { logAudit: async (entry: unknown) => void auditEntries.push(entry) } });
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });

// Imported after the mocks are registered.
const actions = await import("../app/(admin)/actions/ai-settings");

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const originalConsole = { error: console.error, warn: console.warn, log: console.log, info: console.info };
const called = new Set<string>();

before(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.OPENAI_API_KEY = ENV_SECRET;
  delete process.env.XAI_API_KEY;
  for (const level of ["error", "warn", "log", "info"] as const) {
    console[level] = (...args: unknown[]) => void consoleOutput.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  }
});

after(() => {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
  Object.assign(console, originalConsole);
});

function assertNoSecret(label: string, value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  for (const secret of [ADMIN_SECRET, ENV_SECRET]) {
    assert.ok(!text.includes(secret), `${label} leaked a key: ${text.slice(0, 300)}`);
    // No meaningful fragment either — only ever the last 4 characters.
    assert.ok(!text.includes(secret.slice(0, 12)), `${label} leaked a key prefix`);
  }
}

async function call<T>(name: keyof typeof actions, input?: unknown): Promise<T> {
  called.add(name as string);
  const fn = actions[name] as unknown as (input?: unknown) => Promise<T>;
  const result = await fn(input);
  assertNoSecret(`${String(name)} result`, result);
  return result;
}

test("saving a key stores ciphertext + last4 only and returns a masked status", async () => {
  const result = await call<{ success: boolean; data: { source: string; maskedKey: string } }>("saveAiProviderKey", { provider: "xai", apiKey: `  ${ADMIN_SECRET}  ` });
  assert.equal(result.success, true);
  assert.equal(result.data.source, "admin");
  assert.equal(result.data.maskedKey, "••••QRST");

  const row = integrations.get("XAI")!;
  assert.ok(row, "row stored under the XAI enum value");
  assertNoSecret("stored row", row);
  assert.deepEqual(JSON.parse(row.metadata as string), { last4: "QRST" });
  assert.match(row.encryptedCredentials as string, /^[^:]+:[^:]+:[^:]+$/);
});

test("replacing a key audits as replaced", async () => {
  const result = await call<{ success: boolean }>("saveAiProviderKey", { provider: "xai", apiKey: ADMIN_SECRET });
  assert.equal(result.success, true);
  const actionsLogged = auditEntries.map((e) => (e as { action: string }).action);
  assert.deepEqual(actionsLogged.slice(-2), ["ai_key_set", "ai_key_replaced"]);
});

test("invalid key input is rejected without echoing it back", async () => {
  const result = await call<{ success: boolean; error: string }>("saveAiProviderKey", { provider: "xai", apiKey: `${ADMIN_SECRET} with spaces` });
  assert.equal(result.success, false);
  const bad = await call<{ success: boolean }>("saveAiProviderKey", { provider: "not-real", apiKey: ADMIN_SECRET });
  assert.equal(bad.success, false);
});

test("settings view reports sources and masked keys only", async () => {
  const result = await call<{ success: boolean; data: { keys: { provider: string; source: string; maskedKey: string | null }[]; keyStoreAvailable: boolean } }>("getAiProviderSettings");
  assert.equal(result.success, true);
  assert.equal(result.data.keyStoreAvailable, true);
  const byProvider = Object.fromEntries(result.data.keys.map((k) => [k.provider, k]));
  assert.equal(byProvider.xai.source, "admin");
  assert.equal(byProvider.openai.source, "env");
  assert.equal(byProvider.openai.maskedKey, "••••LMNO");
  assert.equal(byProvider.cerebras.source, "none");
  assert.equal(byProvider.cerebras.maskedKey, null);
});

test("test connection sends the decrypted key but redacts it from a provider error echo", async () => {
  let sentAuth = "";
  globalThis.fetch = (async (_url: string, init: { headers: Record<string, string> }) => {
    sentAuth = init.headers.Authorization;
    return new Response(JSON.stringify({ error: `Incorrect API key provided: ${ADMIN_SECRET}` }), { status: 401 });
  }) as unknown as typeof fetch;

  const result = await call<{ success: boolean; error: string }>("testAiProviderConnection", { provider: "xai", model: "" });
  assert.equal(sentAuth, `Bearer ${ADMIN_SECRET}`);
  assert.equal(result.success, false);
  assert.match(result.error, /\[redacted\]/);
  assertNoSecret("stored lastError", integrations.get("XAI"));
});

test("test connection success reports the model and key source", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }), { status: 200 })) as unknown as typeof fetch;
  const result = await call<{ success: boolean; data: { model: string; keySource: string } }>("testAiProviderConnection", { provider: "openrouter", model: "openai/gpt-5" });
  assert.equal(result.success, false, "openrouter has no key configured");

  const ok = await call<{ success: boolean; data: { model: string; keySource: string } }>("testAiProviderConnection", { provider: "xai", model: "grok-4.3" });
  assert.equal(ok.success, true);
  assert.equal(ok.data.model, "grok-4.3");
  assert.equal(ok.data.keySource, "admin");
});

test("switching provider is audited as a switch; models are validated per provider", async () => {
  const bad = await call<{ success: boolean }>("saveAiProviderSettings", { textProvider: "gemini", textModel: "models/x", imageProvider: null, imageModel: "" });
  assert.equal(bad.success, false);

  const noKey = await call<{ success: boolean }>("saveAiProviderSettings", { textProvider: "cerebras", textModel: "", imageProvider: null, imageModel: "" });
  assert.equal(noKey.success, false);

  const ok = await call<{ success: boolean }>("saveAiProviderSettings", { textProvider: "xai", textModel: "grok-4.3", imageProvider: null, imageModel: "" });
  assert.equal(ok.success, true);
  assert.equal((auditEntries.at(-1) as { action: string }).action, "ai_provider_switched");
});

test("removing a key falls back to env/none and audits without the key", async () => {
  const result = await call<{ success: boolean; data: { source: string } }>("removeAiProviderKey", { provider: "xai" });
  assert.equal(result.success, true);
  assert.equal(result.data.source, "none");
  assert.equal(integrations.has("XAI"), false);
  assert.equal((auditEntries.at(-1) as { action: string }).action, "ai_key_removed");
});

test("a broken key store (migration not applied) degrades without leaking", async () => {
  const original = fakePrisma.integration.findMany;
  fakePrisma.integration.findMany = async () => {
    throw new Error('invalid input value for enum "IntegrationProvider"');
  };
  try {
    const result = await call<{ success: boolean; data: { keyStoreAvailable: boolean } }>("getAiProviderSettings");
    assert.equal(result.success, true);
    assert.equal(result.data.keyStoreAvailable, false);
  } finally {
    fakePrisma.integration.findMany = original;
  }
});

test("every exported action was exercised, and no audit entry or log line contains a key", () => {
  const exported = Object.entries(actions)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k)
    .sort();
  assert.deepEqual([...called].sort(), exported, "a new export in ai-settings.ts needs a case in this test");
  assertNoSecret("audit log", auditEntries);
  assertNoSecret("console output", consoleOutput.join("\n"));
});
