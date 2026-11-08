// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultBlockData,
  isSafeHref,
  isSafeImageUrl,
  normalizeBlocksInput,
  parseBlockData,
  parseStoredBlocks,
  reusableBlockIds,
  MAX_BLOCKS_PER_PAGE,
  type PageBlock,
} from "../lib/blocks/schema";
import { resolveBlocks, referencesBlock } from "../lib/blocks/resolve";
import { blocksToText } from "../lib/blocks/text";
import { BLOCK_FIELDS } from "../lib/blocks/fields";
import { BLOCK_TYPES } from "../lib/blocks/types";

const hero = (over: Record<string, unknown> = {}) => ({
  id: "h1",
  type: "hero",
  data: { heading: "Grow faster", primaryCtaLabel: "Book a call", primaryCtaHref: "/contact", ...over },
});

// ---------------------------------------------------------------- url safety
test("isSafeHref allows site paths, anchors and http(s)/mailto/tel only", () => {
  for (const ok of ["/contact", "/a/b?x=1#y", "#pricing", "https://example.com/x", "http://example.com", "mailto:hi@example.com", "tel:+441234567890"]) {
    assert.equal(isSafeHref(ok), true, ok);
  }
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example.com",
    "/\\evil.example.com",
    "\\\\evil.example.com",
    "ftp://example.com",
    "example.com",
    "",
    "   ",
  ]) {
    assert.equal(isSafeHref(bad), false, JSON.stringify(bad));
  }
});

test("isSafeImageUrl allows site paths and http(s) only", () => {
  assert.equal(isSafeImageUrl("/uploads/a.png"), true);
  assert.equal(isSafeImageUrl("https://res.cloudinary.com/x/y.jpg"), true);
  for (const bad of ["javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>", "//evil.com/a.png", "mailto:a@b.c", ""]) {
    assert.equal(isSafeImageUrl(bad), false, bad);
  }
});

// ------------------------------------------------------------ block data
test("every block type has default data and editor fields", () => {
  for (const type of BLOCK_TYPES) {
    assert.ok(defaultBlockData(type), type);
    assert.ok(BLOCK_FIELDS[type].length > 0, type);
  }
});

test("hero: heading is required, unknown keys are stripped, a button needs label and link together", () => {
  assert.equal(parseBlockData("hero", { heading: "" }).ok, false);
  const ok = parseBlockData("hero", { heading: "Hi", evil: "<script>", __proto__: { x: 1 } });
  assert.ok(ok.ok);
  assert.equal("evil" in (ok.ok ? ok.value : {}), false);
  assert.equal(parseBlockData("hero", { heading: "Hi", primaryCtaLabel: "Go" }).ok, false);
  assert.equal(parseBlockData("hero", { heading: "Hi", primaryCtaHref: "/x" }).ok, false);
});

test("javascript: / data: links and images are rejected on every block that has them", () => {
  assert.equal(parseBlockData("hero", { heading: "x", primaryCtaLabel: "a", primaryCtaHref: "javascript:alert(1)" }).ok, false);
  assert.equal(parseBlockData("hero", { heading: "x", imageUrl: "data:image/svg+xml,<svg/>" }).ok, false);
  assert.equal(parseBlockData("cta", { heading: "x", buttonLabel: "a", buttonHref: "javascript:alert(1)" }).ok, false);
  assert.equal(parseBlockData("cards", { items: [{ title: "t", href: "javascript:alert(1)" }] }).ok, false);
  assert.equal(parseBlockData("trustBadges", { items: [{ label: "t", imageUrl: "javascript:alert(1)" }] }).ok, false);
});

test("richText HTML is sanitized when parsed", () => {
  const result = parseBlockData("richText", {
    html: '<p onclick="x()">Hello</p><script>alert(1)</script><img src="javascript:alert(1)" onerror="x()"><a href="javascript:alert(1)">bad</a><a href="https://ok.example">ok</a>',
  });
  assert.ok(result.ok);
  const html = result.ok ? result.value.html : "";
  assert.ok(!/script|onclick|onerror|javascript:/i.test(html), html);
  assert.ok(html.includes("Hello"));
  assert.ok(html.includes('href="https://ok.example"'));
});

test("plain-text fields keep markup as inert text (React escapes it at render)", () => {
  const result = parseBlockData("cta", { heading: "<img src=x onerror=alert(1)>", buttonLabel: "Go", buttonHref: "/go" });
  assert.ok(result.ok);
  // Stored verbatim as text; only richText carries HTML. The renderer outputs it as a React text child.
  assert.equal(result.ok && result.value.heading, "<img src=x onerror=alert(1)>");
});

test("cards columns are coerced and bounded; lists are capped", () => {
  const r = parseBlockData("cards", { items: [{ title: "a" }], columns: "4" });
  assert.ok(r.ok && r.value.columns === 4);
  assert.equal(parseBlockData("cards", { items: [{ title: "a" }], columns: 9 }).ok, false);
  assert.equal(parseBlockData("cards", { items: Array.from({ length: 25 }, () => ({ title: "a" })) }).ok, false);
});

test("lead form defaults and faq sources", () => {
  const lead = parseBlockData("leadForm", { heading: "Talk to us" });
  assert.ok(lead.ok && lead.value.showMessage === true && lead.value.showPhone === false && lead.value.submitLabel === "Send");
  assert.equal(parseBlockData("faq", { source: "nope" }).ok, false);
  assert.equal(parseBlockData("faq", { items: [{ question: "q", answer: "" }] }).ok, false);
});

// ------------------------------------------------------------ page-level
test("normalizeBlocksInput: empty means no layout (null), valid input round-trips as JSON", () => {
  for (const empty of [undefined, null, "", []]) {
    const r = normalizeBlocksInput(empty);
    assert.ok(r.ok && r.value.json === null);
  }
  const r = normalizeBlocksInput([hero(), { id: "r1", type: "reusable", blockId: "blk_1" }]);
  assert.ok(r.ok);
  assert.deepEqual(parseStoredBlocks(r.ok ? r.value.json : null).map((b) => b.type), ["hero", "reusable"]);
});

test("normalizeBlocksInput reports which block is wrong and rejects structural problems", () => {
  const bad = normalizeBlocksInput([hero(), { id: "c1", type: "cta", data: { heading: "x" } }]);
  assert.ok(!bad.ok && /Block 2 \(cta\)/.test(bad.error), JSON.stringify(bad));
  assert.equal(normalizeBlocksInput([{ id: "a", type: "script", data: {} }]).ok, false);
  assert.equal(normalizeBlocksInput([{ type: "hero", data: { heading: "x" } }]).ok, false); // no id
  assert.equal(normalizeBlocksInput([hero(), hero()]).ok, false); // duplicate id
  assert.equal(normalizeBlocksInput("{not json").ok, false);
  assert.equal(normalizeBlocksInput({ not: "a list" }).ok, false);
  assert.equal(normalizeBlocksInput([{ id: "r", type: "reusable" }]).ok, false);
  const many = Array.from({ length: MAX_BLOCKS_PER_PAGE + 1 }, (_, i) => ({ ...hero(), id: `h${i}` }));
  assert.equal(normalizeBlocksInput(many).ok, false);
});

test("normalizeBlocksInput accepts the JSON string form too", () => {
  assert.ok(normalizeBlocksInput(JSON.stringify([hero()])).ok);
});

test("parseStoredBlocks is lenient: a bad block is dropped, the rest render; garbage yields nothing", () => {
  const raw = JSON.stringify([
    hero(),
    { id: "bad", type: "cta", data: { heading: "x", buttonLabel: "y", buttonHref: "javascript:alert(1)" } },
    { id: "unknown", type: "iframe", data: { src: "https://evil" } },
    { ...hero(), id: "h2", data: { heading: "Second" } },
  ]);
  assert.deepEqual(parseStoredBlocks(raw).map((b) => b.id), ["h1", "h2"]);
  for (const garbage of [null, undefined, "", "{", "123", '"str"', "{}", "null"]) {
    assert.deepEqual(parseStoredBlocks(garbage as string | null), []);
  }
});

test("legacy pages (no blocks) parse to an empty layout and keep the classic template", () => {
  assert.deepEqual(parseStoredBlocks(null), []);
});

// ---------------------------------------------------------------- reusable
test("reusableBlockIds de-duplicates", () => {
  const blocks = [
    { id: "a", type: "reusable", blockId: "x" },
    { id: "b", type: "reusable", blockId: "x" },
    { id: "c", type: "reusable", blockId: "y" },
  ] as PageBlock[];
  assert.deepEqual(reusableBlockIds(blocks), ["x", "y"]);
});

test("resolveBlocks swaps references for the block's CURRENT data (edit once, update everywhere)", () => {
  const pageA = parseStoredBlocks(JSON.stringify([{ id: "a1", type: "reusable", blockId: "cta1" }]));
  const pageB = parseStoredBlocks(JSON.stringify([hero(), { id: "b2", type: "reusable", blockId: "cta1" }]));
  const stored = (heading: string) =>
    new Map([["cta1", { type: "cta", data: JSON.stringify({ heading, buttonLabel: "Go", buttonHref: "/go" }) }]]);

  const before = [resolveBlocks(pageA, stored("Old")), resolveBlocks(pageB, stored("Old"))];
  assert.ok(before.every((r) => r.some((b) => b.type === "cta" && b.data.heading === "Old")));

  // The same stored page JSON, a different reusable row: both pages change without being touched.
  const after = [resolveBlocks(pageA, stored("New")), resolveBlocks(pageB, stored("New"))];
  assert.ok(after.every((r) => r.some((b) => b.type === "cta" && b.data.heading === "New")));
  assert.equal(after[1][1].id, "b2"); // page-level id kept, so the same block twice on a page keeps unique keys
});

test("resolveBlocks drops missing, unknown-type, corrupt and invalid reusable blocks", () => {
  const refs = parseStoredBlocks(
    JSON.stringify(["missing", "unknown", "corrupt", "invalid", "good"].map((id, i) => ({ id: `r${i}`, type: "reusable", blockId: id }))),
  );
  const reusable = new Map([
    ["unknown", { type: "iframe", data: "{}" }],
    ["corrupt", { type: "cta", data: "{not json" }],
    ["invalid", { type: "cta", data: JSON.stringify({ heading: "x", buttonLabel: "y", buttonHref: "javascript:alert(1)" }) }],
    ["good", { type: "cta", data: JSON.stringify({ heading: "ok", buttonLabel: "y", buttonHref: "/ok" }) }],
  ]);
  const out = resolveBlocks(refs, reusable);
  assert.deepEqual(out.map((b) => b.id), ["r4"]);
});

test("a reusable block's stored HTML is re-sanitized when resolved (defense in depth)", () => {
  const refs = parseStoredBlocks(JSON.stringify([{ id: "r", type: "reusable", blockId: "t" }]));
  const out = resolveBlocks(refs, new Map([["t", { type: "richText", data: JSON.stringify({ html: "<p>hi</p><script>alert(1)</script>" }) }]]));
  assert.equal(out[0].type, "richText");
  assert.ok(out[0].type === "richText" && !/script/i.test(out[0].data.html));
});

test("referencesBlock is an exact match on parsed references, not a substring of the JSON", () => {
  const raw = JSON.stringify([{ id: "a", type: "reusable", blockId: "abc123" }, { ...hero(), data: { heading: "mentions xyz789 in text" } }]);
  assert.equal(referencesBlock(raw, "abc123"), true);
  assert.equal(referencesBlock(raw, "xyz789"), false);
  assert.equal(referencesBlock(raw, "abc"), false);
  assert.equal(referencesBlock(null, "abc123"), false);
});

// -------------------------------------------------------------- editor text
test("blocksToText feeds the SEO panel with copy, not URLs or ids", () => {
  const text = blocksToText([
    { type: "hero", data: { heading: "Grow faster", primaryCtaHref: "/contact", imageUrl: "https://x/y.png" } },
    { type: "faq", data: { source: "custom", items: [{ question: "Why?", answer: "Because." }] } },
    { type: "reusable" },
  ]);
  assert.ok(text.includes("Grow faster") && text.includes("Why?") && text.includes("Because."));
  assert.ok(!text.includes("/contact") && !text.includes("y.png") && !text.includes("custom"));
});
