// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWebVitalsBatch, rateWebVital } from "../lib/web-vitals";

test("a normal report becomes one sample per metric, rated server-side", () => {
  const batch = parseWebVitalsBatch({ path: "/blog/x", metrics: { LCP: 2100, CLS: 0.3, TTFB: 2000 } });
  assert.deepEqual(batch, {
    path: "/blog/x",
    samples: [
      { metric: "LCP", value: 2100, rating: "good" },
      { metric: "TTFB", value: 2000, rating: "poor" },
      { metric: "CLS", value: 0.3, rating: "poor" },
    ],
  });
});

test("query strings and fragments are stripped and long paths truncated", () => {
  assert.equal(parseWebVitalsBatch({ path: "/a?utm=1#top", metrics: { FCP: 900 } })?.path, "/a");
  assert.equal(parseWebVitalsBatch({ path: "/" + "x".repeat(500), metrics: { FCP: 900 } })?.path.length, 200);
});

test("unknown metrics and out-of-range values are dropped", () => {
  const batch = parseWebVitalsBatch({ path: "/", metrics: { LCP: -1, INP: 1e9, CLS: Number.NaN, FOO: 5, FCP: "900", TTFB: 300 } });
  assert.deepEqual(batch?.samples, [{ metric: "TTFB", value: 300, rating: "good" }]);
});

test("unusable reports are rejected", () => {
  assert.equal(parseWebVitalsBatch(null), null);
  assert.equal(parseWebVitalsBatch({ path: "https://evil.example/", metrics: { LCP: 1 } }), null);
  assert.equal(parseWebVitalsBatch({ path: "//evil.example/", metrics: { LCP: 1 } }), null);
  assert.equal(parseWebVitalsBatch({ path: "/", metrics: [1, 2] }), null);
  assert.equal(parseWebVitalsBatch({ path: "/", metrics: { LCP: -5 } }), null);
  // The old one-metric-per-request shape is no longer accepted.
  assert.equal(parseWebVitalsBatch({ path: "/", metric: "LCP", value: 1000, rating: "good" }), null);
});

test("ratings use Google's thresholds, inclusive at the boundary", () => {
  assert.equal(rateWebVital("TTFB", 800), "good");
  assert.equal(rateWebVital("TTFB", 1800), "needs-improvement");
  assert.equal(rateWebVital("TTFB", 1801), "poor");
  assert.equal(rateWebVital("CLS", 0.1), "good");
});
