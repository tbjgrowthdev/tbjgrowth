// Run with: npm test
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { providerFetch } from "../lib/content-pipeline/providers/http";
import { AiProviderError } from "../lib/content-pipeline/providers/types";
import { requestPipelineStage } from "../lib/admin/action-errors";
import { isJobStale, STALE_JOB_MS } from "../lib/content-pipeline/types";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// A fetch that never answers on its own, only rejecting when its signal aborts — a hung provider.
function hangingFetch(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
    })) as typeof fetch;
}

function streamResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status });
}

test("a provider that never responds fails with a timeout error instead of hanging", async () => {
  globalThis.fetch = hangingFetch();
  await assert.rejects(
    providerFetch("Test API", "https://example.invalid", { method: "POST" }, 50),
    (error: unknown) => error instanceof AiProviderError && /did not respond within/.test((error as Error).message)
  );
});

test("a network failure becomes a readable AiProviderError", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  await assert.rejects(
    providerFetch("Test API", "https://example.invalid", {}, 1000),
    (error: unknown) => error instanceof AiProviderError && /Could not reach Test API/.test((error as Error).message)
  );
});

test("stage stream: heartbeats then a result line is parsed as the result", async () => {
  globalThis.fetch = (async () => streamResponse(["\n", "\n", '{"success":false,"error":"Bad JSON"}\n'])) as typeof fetch;
  assert.deepEqual(await requestPipelineStage("run1", "DRAFT"), { success: false, error: "Bad JSON" });
});

test("stage stream: a stream that ends with only heartbeats means the outcome is unknown", async () => {
  globalThis.fetch = (async () => streamResponse(["\n", "\n"])) as typeof fetch;
  const result = await requestPipelineStage("run1", "DRAFT");
  assert.equal(result.success, false);
  assert.equal(result.connectionLost, true);
});

test("stage stream: a dropped connection never throws, it reports connectionLost", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("network error");
  }) as typeof fetch;
  const result = await requestPipelineStage("run1", "DRAFT");
  assert.equal(result.connectionLost, true);
});

test("stage stream: a client-side timeout reports connectionLost", async () => {
  globalThis.fetch = hangingFetch();
  const result = await requestPipelineStage("run1", "DRAFT", 30);
  assert.equal(result.connectionLost, true);
});

test("a PROCESSING job counts as abandoned only after the stale window", () => {
  const now = Date.now();
  assert.equal(isJobStale({ status: "PROCESSING", startedAt: new Date(now - 60_000) }, now), false);
  assert.equal(isJobStale({ status: "PROCESSING", startedAt: new Date(now - STALE_JOB_MS - 1) }, now), true);
  assert.equal(isJobStale({ status: "COMPLETED", startedAt: new Date(0) }, now), false);
});
