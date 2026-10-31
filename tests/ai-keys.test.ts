// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  isValidModelName,
  keyLast4,
  maskKey,
  redactSecret,
  AI_KEY_PROVIDERS,
  PROVIDER_KEY_ENV,
  TEXT_PROVIDERS,
} from "../lib/content-pipeline/providers/catalog";
import { resolveKeyWith, type KeyResolutionDeps } from "../lib/content-pipeline/providers/keys";
import { COMPATIBLE_APIS, buildCompatibleRequestBody, parseCompatibleUsage } from "../lib/content-pipeline/providers/openai-compatible";
import { encryptJson, decryptJson } from "../lib/integrations/crypto";
import { estimateCostUsd } from "../lib/content-pipeline/pricing";

const DB_KEY = "sk-db-key-1234567890abcdWXYZ";
const ENV_KEY = "sk-env-key-0987654321zyxw9876";

function deps(overrides: Partial<KeyResolutionDeps> & { logs?: string[] } = {}): KeyResolutionDeps {
  const logs = overrides.logs ?? [];
  return {
    readEncrypted: async () => null,
    decrypt: (packed) => JSON.parse(packed),
    env: {},
    log: (m) => logs.push(m),
    ...overrides,
  };
}

// --- Key resolution order -------------------------------------------------

test("DB key wins over the env var", async () => {
  const r = await resolveKeyWith("openai", deps({ readEncrypted: async () => JSON.stringify({ apiKey: DB_KEY }), env: { OPENAI_API_KEY: ENV_KEY } }));
  assert.deepEqual(r, { key: DB_KEY, source: "admin" });
});

test("no DB row falls back to the env var (zero-rows behavior unchanged)", async () => {
  const r = await resolveKeyWith("anthropic", deps({ env: { ANTHROPIC_API_KEY: ENV_KEY } }));
  assert.deepEqual(r, { key: ENV_KEY, source: "env" });
});

test("no DB row and no env var resolves to none", async () => {
  const r = await resolveKeyWith("cerebras", deps());
  assert.deepEqual(r, { key: null, source: "none" });
});

test("blank env var counts as not configured", async () => {
  const r = await resolveKeyWith("xai", deps({ env: { XAI_API_KEY: "   " } }));
  assert.equal(r.source, "none");
});

test("unknown provider resolves to none without touching the DB", async () => {
  let called = false;
  const r = await resolveKeyWith("not-a-provider", deps({ readEncrypted: async () => ((called = true), null) }));
  assert.deepEqual(r, { key: null, source: "none" });
  assert.equal(called, false);
});

// --- Failure fallback -----------------------------------------------------

test("DB read failure (missing table/enum) logs and falls back to env", async () => {
  const logs: string[] = [];
  const r = await resolveKeyWith(
    "gemini",
    deps({
      logs,
      readEncrypted: async () => {
        throw new Error('invalid input value for enum "IntegrationProvider": "GEMINI"');
      },
      env: { GEMINI_API_KEY: ENV_KEY },
    })
  );
  assert.deepEqual(r, { key: ENV_KEY, source: "env" });
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes(ENV_KEY));
});

test("decryption failure logs and falls back to env, never logging key material", async () => {
  const logs: string[] = [];
  const packed = "iv:tag:ciphertext-" + DB_KEY;
  const r = await resolveKeyWith(
    "openrouter",
    deps({
      logs,
      readEncrypted: async () => packed,
      decrypt: () => {
        throw new Error("Unsupported state or unable to authenticate data");
      },
      env: { OPENROUTER_API_KEY: ENV_KEY },
    })
  );
  assert.deepEqual(r, { key: ENV_KEY, source: "env" });
  assert.equal(logs.length, 1);
  for (const secret of [DB_KEY, ENV_KEY, packed]) assert.ok(!logs[0].includes(secret));
});

test("decryption failure with no env var resolves to none (never throws)", async () => {
  const r = await resolveKeyWith("openai", deps({ readEncrypted: async () => "x", decrypt: () => { throw new Error("bad"); } }));
  assert.deepEqual(r, { key: null, source: "none" });
});

test("malformed decrypted payload falls back to env", async () => {
  for (const payload of [{}, { apiKey: 42 }, { apiKey: "  " }]) {
    const r = await resolveKeyWith("openai", deps({ readEncrypted: async () => "x", decrypt: () => payload, env: { OPENAI_API_KEY: ENV_KEY } }));
    assert.deepEqual(r, { key: ENV_KEY, source: "env" });
  }
});

test("real AES-256-GCM round trip, and a rotated encryption key falls back to env", async () => {
  const original = process.env.INTEGRATION_ENCRYPTION_KEY;
  try {
    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const packed = encryptJson({ apiKey: DB_KEY });
    assert.ok(!packed.includes(DB_KEY));
    const live = deps({ readEncrypted: async () => packed, decrypt: (p) => decryptJson(p), env: { OPENAI_API_KEY: ENV_KEY } });

    assert.deepEqual(await resolveKeyWith("openai", live), { key: DB_KEY, source: "admin" });

    process.env.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64"); // rotation orphans the stored key
    assert.deepEqual(await resolveKeyWith("openai", live), { key: ENV_KEY, source: "env" });
  } finally {
    if (original === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = original;
  }
});

// --- Masking / redaction --------------------------------------------------

test("maskKey shows at most the last 4 characters", () => {
  assert.equal(maskKey(DB_KEY), "••••WXYZ");
  assert.equal(maskKey("short123"), "••••");
  assert.equal(maskKey(""), null);
  assert.equal(maskKey(null), null);
  assert.equal(keyLast4(DB_KEY), "WXYZ");
  assert.equal(keyLast4("short123"), "");
});

test("redactSecret removes every occurrence of the key", () => {
  const out = redactSecret(`Incorrect API key provided: ${DB_KEY}. Key ${DB_KEY} revoked.`, DB_KEY);
  assert.ok(!out.includes(DB_KEY));
  assert.equal(redactSecret("no key here", null), "no key here");
});

// --- Model-name validation -----------------------------------------------

test("model names: strict pattern for everyone, one '/' only for OpenRouter", () => {
  for (const p of TEXT_PROVIDERS) assert.ok(isValidModelName(p, "model-1.5:latest"), p);

  assert.ok(isValidModelName("openrouter", "openai/gpt-5"));
  assert.ok(isValidModelName("openrouter", "meta-llama/llama-3.3-70b-instruct:free"));
  assert.ok(!isValidModelName("openrouter", "a/b/c"));
  assert.ok(!isValidModelName("openrouter", "/gpt-5"));
  assert.ok(!isValidModelName("openrouter", "openai/"));

  // Gemini interpolates the model into its URL path: no slash, traversal, query or whitespace.
  for (const bad of ["models/gemini", "../x", "gemini?key=x", "gemini#x", "gemini flash", "gemini%2Fx", "", "-leading-dash"]) {
    assert.ok(!isValidModelName("gemini", bad), bad);
  }
  for (const p of ["anthropic", "openai", "xai", "cerebras"]) assert.ok(!isValidModelName(p, "vendor/model"), p);
  assert.ok(!isValidModelName("openai", "x".repeat(101)));
});

// --- Catalog wiring -------------------------------------------------------

test("every key provider has an env var name", () => {
  for (const p of AI_KEY_PROVIDERS) assert.match(PROVIDER_KEY_ENV[p], /^[A-Z]+_API_KEY$/);
  assert.equal(PROVIDER_KEY_ENV.xai, "XAI_API_KEY");
  assert.equal(PROVIDER_KEY_ENV.openrouter, "OPENROUTER_API_KEY");
  assert.equal(PROVIDER_KEY_ENV.cerebras, "CEREBRAS_API_KEY");
});

// --- OpenAI-compatible provider ------------------------------------------

test("each compatible API uses its documented max-tokens parameter", () => {
  const body = (name: string) => buildCompatibleRequestBody(COMPATIBLE_APIS[name], "m", "s", "u", 99) as Record<string, unknown>;
  assert.equal(body("xai").max_completion_tokens, 99);
  assert.equal(body("xai").max_tokens, undefined);
  assert.equal(body("cerebras").max_completion_tokens, 99);
  assert.equal(body("cerebras").max_tokens, undefined);
  assert.equal(body("openrouter").max_tokens, 99);
  assert.equal(body("openrouter").max_completion_tokens, undefined);
  assert.equal(COMPATIBLE_APIS.xai.baseUrl, "https://api.x.ai/v1");
  assert.equal(COMPATIBLE_APIS.openrouter.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(COMPATIBLE_APIS.cerebras.baseUrl, "https://api.cerebras.ai/v1");
});

test("usage parsing is defensive: missing or junk counts become 0 and flag unknown", () => {
  assert.deepEqual(parseCompatibleUsage({ prompt_tokens: 10, completion_tokens: 5 }), { inputTokens: 10, outputTokens: 5, usageUnknown: false });
  assert.deepEqual(parseCompatibleUsage(undefined), { inputTokens: 0, outputTokens: 0, usageUnknown: true });
  assert.deepEqual(parseCompatibleUsage(null), { inputTokens: 0, outputTokens: 0, usageUnknown: true });
  assert.deepEqual(parseCompatibleUsage({ prompt_tokens: "10", completion_tokens: 5 }), { inputTokens: 0, outputTokens: 5, usageUnknown: true });
  assert.deepEqual(parseCompatibleUsage({ prompt_tokens: -1, completion_tokens: NaN }), { inputTokens: 0, outputTokens: 0, usageUnknown: true });
});

test("unpriced models cost null (unknown), never 0", () => {
  assert.equal(estimateCostUsd("openrouter", "openai/gpt-5", 1000, 1000), null);
  assert.equal(estimateCostUsd("cerebras", "gpt-oss-120b", 1000, 1000), null);
  assert.ok((estimateCostUsd("xai", "grok-4.3", 1_000_000, 0) ?? 0) > 0);
});
