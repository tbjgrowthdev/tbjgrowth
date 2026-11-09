// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_BLOCKS_JSON_BYTES, MAX_BLOCKS_PER_PAGE, normalizeBlocksInput, parseBlockData, parseStoredBlocks } from "../lib/blocks/schema";
import { blocksUpdate } from "../lib/blocks/save";
import { blocksToExcerpt, blocksToText } from "../lib/blocks/text";
import { hasQuote, tableIsRenderable, visibleProofItems } from "../lib/blocks/visible";
import { BLOCK_FIELDS, BLOCK_HELP, BLOCK_LABELS } from "../lib/blocks/fields";
import { BLOCK_TYPES, defaultBlockData } from "../lib/blocks/types";
import { IMPORT_MAX_BYTES, mergeImported, newBlockId, parseImportText, summarizeBlocks, withFreshIds } from "../lib/blocks/import";

const NEW_TYPES = ["metricHero", "factsStrip", "dataTable", "proofGallery", "pullQuote", "takeaway"] as const;

test("new block types are registered everywhere", () => {
  for (const t of NEW_TYPES) {
    assert.ok((BLOCK_TYPES as readonly string[]).includes(t), t);
    assert.ok(BLOCK_LABELS[t] && BLOCK_HELP[t] && BLOCK_FIELDS[t].length > 0, t);
    assert.ok(defaultBlockData(t), t);
  }
});

// ---------------------------------------------------------------- metricHero
test("metricHero: label and value required; from/to together; unknown keys stripped", () => {
  assert.equal(parseBlockData("metricHero", {}).ok, false);
  assert.equal(parseBlockData("metricHero", { label: "Reach" }).ok, false);
  assert.equal(parseBlockData("metricHero", { value: "+423%" }).ok, false);
  const ok = parseBlockData("metricHero", { label: "Reach", value: "+423%", from: "18,400", to: "96,300", evil: "x" });
  assert.ok(ok.ok && !("evil" in ok.value));
  assert.equal(parseBlockData("metricHero", { label: "Reach", value: "1", from: "1" }).ok, false);
  assert.equal(parseBlockData("metricHero", { label: "Reach", value: "1", to: "2" }).ok, false);
  assert.equal(parseBlockData("metricHero", { label: "x".repeat(121), value: "1" }).ok, false);
  assert.equal(parseBlockData("metricHero", { label: "a", value: "1".repeat(41) }).ok, false);
});

// ---------------------------------------------------------------- factsStrip
test("factsStrip: up to 6 label/value pairs; empty list is valid and renders nothing", () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
  assert.ok(parseBlockData("factsStrip", { items: items(6) }).ok);
  assert.equal(parseBlockData("factsStrip", { items: items(7) }).ok, false);
  assert.equal(parseBlockData("factsStrip", { items: [{ label: "Client", value: "" }] }).ok, false);
  assert.equal(parseBlockData("factsStrip", { items: [{ label: "", value: "x" }] }).ok, false);
  const empty = parseBlockData("factsStrip", {});
  assert.ok(empty.ok && empty.value.items.length === 0);
});

// ---------------------------------------------------------------- dataTable
const table = (over: Record<string, unknown> = {}) => ({ columns: ["Metric", "Before", "After", "Change"], rows: [["Reach", "18,400", "96,300", "+423%"]], ...over });

test("dataTable: valid data round-trips; rows must match the columns", () => {
  const ok = parseBlockData("dataTable", table({ highlightLastColumn: true, footnote: "Source: analytics" }));
  assert.ok(ok.ok && ok.value.highlightLastColumn === true && ok.value.rows[0][3] === "+423%");
  assert.equal(parseBlockData("dataTable", table({ rows: [["only", "three", "cells"]] })).ok, false);
  assert.equal(parseBlockData("dataTable", table({ rows: [["a", "b", "c", "d", "e"]] })).ok, false);
});

test("dataTable: column / row / cell limits and required headers", () => {
  assert.equal(parseBlockData("dataTable", { columns: [], rows: [] }).ok, false);
  assert.equal(parseBlockData("dataTable", { columns: ["a", ""], rows: [] }).ok, false);
  assert.equal(parseBlockData("dataTable", { columns: Array.from({ length: 7 }, (_, i) => `c${i}`), rows: [] }).ok, false);
  assert.ok(parseBlockData("dataTable", { columns: Array.from({ length: 6 }, (_, i) => `c${i}`), rows: [] }).ok);
  assert.equal(parseBlockData("dataTable", table({ rows: Array.from({ length: 21 }, () => ["a", "b", "c", "d"]) })).ok, false);
  assert.equal(parseBlockData("dataTable", table({ rows: [["a", "b", "c", "x".repeat(201)]] })).ok, false);
  assert.equal(parseBlockData("dataTable", table({ rows: [["a", "b", 3, "d"]] })).ok, false);
});

test("dataTable: cells stay inert text (no HTML interpretation), and empty tables don't render", () => {
  const r = parseBlockData("dataTable", table({ rows: [["<img src=x onerror=alert(1)>", "b", "c", "d"]] }));
  assert.ok(r.ok && r.value.rows[0][0] === "<img src=x onerror=alert(1)>"); // rendered as a React text child
  const noRows = parseBlockData("dataTable", { columns: ["a"] });
  assert.ok(noRows.ok && !tableIsRenderable(noRows.value.columns, noRows.value.rows));
  assert.ok(tableIsRenderable(["a"], [["1"]]));
});

// ---------------------------------------------------------------- proofGallery
test("proofGallery: image rules, limits and empty items", () => {
  assert.ok(parseBlockData("proofGallery", { items: [{ imageUrl: "https://res.cloudinary.com/x/a.png", imageAlt: "Dashboard", caption: "c", badge: "Illustrative" }] }).ok);
  assert.equal(parseBlockData("proofGallery", { items: [{ imageUrl: "javascript:alert(1)" }] }).ok, false);
  assert.equal(parseBlockData("proofGallery", { items: [{ imageUrl: "data:image/svg+xml,<svg/>" }] }).ok, false);
  assert.equal(parseBlockData("proofGallery", { items: Array.from({ length: 13 }, () => ({})) }).ok, false);
  assert.equal(parseBlockData("proofGallery", { columns: 4 }).ok, false);
  assert.equal(parseBlockData("proofGallery", { items: [{ badge: "x".repeat(41) }] }).ok, false);
  const empty = parseBlockData("proofGallery", {});
  assert.ok(empty.ok && empty.value.columns === 2 && empty.value.items.length === 0);
});

test("proofGallery: items with no/undisplayable image are skipped; none left means nothing renders", () => {
  const items = [
    { imageUrl: "", imageAlt: "", caption: "placeholder", badge: "" },
    { imageUrl: "https://evil.example.com/a.png", imageAlt: "", caption: "not an allowed host", badge: "" },
    { imageUrl: "https://res.cloudinary.com/x/a.png", imageAlt: "ok", caption: "", badge: "" },
    { imageUrl: "/uploads/b.png", imageAlt: "ok2", caption: "", badge: "" },
  ];
  assert.deepEqual(visibleProofItems(items).map((i) => i.imageAlt), ["ok", "ok2"]);
  assert.deepEqual(visibleProofItems(items.slice(0, 2)), []);
  assert.deepEqual(visibleProofItems([]), []);
});

// ---------------------------------------------------------------- pullQuote
test("pullQuote: empty quote is valid but hidden; length limits", () => {
  const empty = parseBlockData("pullQuote", {});
  assert.ok(empty.ok && !hasQuote(empty.value.quote));
  assert.ok(!hasQuote("   "));
  const filled = parseBlockData("pullQuote", { quote: " Great work ", name: "A. Client", role: "CEO" });
  assert.ok(filled.ok && hasQuote(filled.value.quote) && filled.value.quote === "Great work");
  assert.equal(parseBlockData("pullQuote", { quote: "x".repeat(601) }).ok, false);
  assert.equal(parseBlockData("pullQuote", { quote: "q", name: "x".repeat(121) }).ok, false);
});

// ---------------------------------------------------------------- takeaway
test("takeaway: text required, label defaults, an explicit empty label is kept", () => {
  assert.equal(parseBlockData("takeaway", {}).ok, false);
  assert.equal(parseBlockData("takeaway", { text: "x".repeat(501) }).ok, false);
  const d = parseBlockData("takeaway", { text: "Do the thing" });
  assert.ok(d.ok && d.value.label === "Key takeaway");
  const noLabel = parseBlockData("takeaway", { label: "", text: "Do the thing" });
  assert.ok(noLabel.ok && noLabel.value.label === "");
});

// ---------------------------------------------------------------- cards variant
test("cards: variant is optional (old data = default) and restricted", () => {
  const old = parseBlockData("cards", { items: [{ title: "a" }] });
  assert.ok(old.ok && old.value.variant === "default");
  assert.ok(parseBlockData("cards", { variant: "stats", items: [{ title: "5.2×", text: "faster" }] }).ok);
  assert.ok(parseBlockData("cards", { variant: "steps", items: [{ title: "Audit" }] }).ok);
  assert.equal(parseBlockData("cards", { variant: "fancy", items: [] }).ok, false);
});

// ---------------------------------------------------------------- text / SEO
test("blocksToText includes new-block copy but not badges, hidden quotes or image-less gallery items", () => {
  const text = blocksToText([
    { type: "metricHero", data: { label: "Monthly social reach", value: "+423%" } },
    { type: "factsStrip", data: { items: [{ label: "Client", value: "Acme" }] } },
    { type: "dataTable", data: { heading: "Results", columns: ["Metric", "Change"], rows: [["Reach", "+423%"]], highlightLastColumn: true } },
    { type: "takeaway", data: { label: "Key takeaway", text: "Consistency wins" } },
    { type: "pullQuote", data: { quote: "", name: "Hidden Person", role: "Hidden Role" } },
    { type: "proofGallery", data: { items: [{ imageUrl: "", caption: "Hidden caption", badge: "Illustrative" }, { imageUrl: "/a.png", caption: "Shown caption", badge: "Illustrative" }] } },
  ]);
  for (const s of ["Monthly social reach", "+423%", "Acme", "Metric", "Reach", "Consistency wins", "Shown caption"]) assert.ok(text.includes(s), s);
  for (const s of ["Hidden Person", "Hidden Role", "Hidden caption", "Illustrative", "/a.png"]) assert.ok(!text.includes(s), s);
  const withQuote = blocksToText([{ type: "pullQuote", data: { quote: "Brilliant", name: "Pat" } }]);
  assert.ok(withQuote.includes("Brilliant") && withQuote.includes("Pat"));
});

test("blocksToExcerpt takes the first prose field and trims on a word boundary", () => {
  assert.equal(blocksToExcerpt([{ type: "metricHero", data: { label: "x", value: "1" } }, { type: "takeaway", data: { text: "Short and sweet" } }]), "Short and sweet");
  assert.equal(blocksToExcerpt([{ type: "richText", data: { html: "<p>Hello&nbsp;<strong>world</strong></p>" } }]), "Hello world");
  assert.equal(blocksToExcerpt([]), "");
  const long = blocksToExcerpt([{ type: "takeaway", data: { text: "word ".repeat(100) } }]);
  assert.ok(long.length <= 156 && long.endsWith("…") && !long.includes("wor…"), long);
});

// ---------------------------------------------------------------- blocks column
test("blocksUpdate: omitted = no write, [] = null (classic), valid = JSON, invalid = error", () => {
  assert.deepEqual(blocksUpdate(undefined), { ok: true, data: {} });
  assert.deepEqual(blocksUpdate([]), { ok: true, data: { blocks: null } });
  assert.deepEqual(blocksUpdate(null), { ok: true, data: { blocks: null } });
  const good = blocksUpdate([{ id: "t1", type: "takeaway", data: { text: "Hi" } }]);
  assert.ok(good.ok && typeof good.data.blocks === "string");
  assert.equal(parseStoredBlocks(good.ok ? good.data.blocks : null)[0].type, "takeaway");
  const bad = blocksUpdate([{ id: "t1", type: "takeaway", data: {} }]);
  assert.ok(!bad.ok && /Block 1 \(takeaway\)/.test(bad.error), JSON.stringify(bad));
});

test("blocks column: a classic case study (null) parses to no layout; stored HTML is sanitized", () => {
  assert.deepEqual(parseStoredBlocks(null), []);
  const r = blocksUpdate([{ id: "r1", type: "richText", data: { html: "<p>hi</p><script>alert(1)</script>" } }]);
  assert.ok(r.ok && !/script/i.test(r.data.blocks ?? ""));
});

test("normalizeBlocksInput enforces a total size cap", () => {
  const big = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, type: "richText", data: { html: `<p>${"a".repeat(90_000)}</p>` } }));
  assert.ok(JSON.stringify(big).length > MAX_BLOCKS_JSON_BYTES);
  const r = normalizeBlocksInput(big);
  assert.ok(!r.ok && /too large/.test(r.error), JSON.stringify(r).slice(0, 120));
});

// ---------------------------------------------------------------- import
const imported = (over: Record<string, unknown> = {}) => ({ type: "takeaway", data: { text: "Hi" }, ...over });

test("parseImportText: accepts a list or { blocks }, rejects bad input with clear errors", () => {
  const list = parseImportText(JSON.stringify([imported()]));
  assert.ok(list.ok && list.value.length === 1);
  const wrapped = parseImportText(JSON.stringify({ blocks: [imported()] }));
  assert.ok(wrapped.ok && wrapped.value.length === 1);
  for (const bad of ["", "   ", "{nope", "123", '"str"', "{}", JSON.stringify({ blocks: "x" }), "[]"]) {
    assert.equal(parseImportText(bad).ok, false, bad);
  }
  const tooMany = parseImportText(JSON.stringify(Array.from({ length: MAX_BLOCKS_PER_PAGE + 1 }, () => imported())));
  assert.ok(!tooMany.ok && /at most/.test(tooMany.error));
  const huge = parseImportText(JSON.stringify([imported({ data: { text: "x".repeat(IMPORT_MAX_BYTES) } })]));
  assert.ok(!huge.ok && /limit/.test(huge.error));
});

test("withFreshIds replaces missing, duplicate and colliding ids so the import always passes the id rules", () => {
  const existingId = "keep-me";
  const out = withFreshIds([imported({ id: "dup" }), imported({ id: "dup" }), imported(), imported({ id: existingId }), "not a block"]) as { id?: string }[];
  const ids = out.slice(0, 4).map((b) => b.id);
  assert.equal(new Set(ids).size, 4);
  assert.ok(!ids.includes("dup") && !ids.includes(existingId));
  assert.equal(out[4] as unknown, "not a block"); // left for the server to report
  const minted = new Set(Array.from({ length: 500 }, () => newBlockId()));
  assert.equal(minted.size, 500);
  // The fixed-up list is exactly what normalizeBlocksInput needs.
  assert.ok(normalizeBlocksInput(out.slice(0, 4)).ok);
  // And the server-side validator still reports a bad block by position and type.
  const bad = normalizeBlocksInput(withFreshIds([imported(), { type: "takeaway", data: {} }]));
  assert.ok(!bad.ok && /Block 2 \(takeaway\)/.test(bad.error), JSON.stringify(bad));
});

test("mergeImported: replace vs append, and the 60-block cap applies to the combined list", () => {
  const mk = (n: number, p: string) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, type: "takeaway" }));
  const replaced = mergeImported(mk(3, "e"), mk(2, "i"), "replace");
  assert.ok(replaced.ok && replaced.value.map((b) => b.id).join() === "i0,i1");
  const appended = mergeImported(mk(3, "e"), mk(2, "i"), "append");
  assert.ok(appended.ok && appended.value.length === 5 && appended.value[0].id === "e0");
  const over = mergeImported(mk(50, "e"), mk(11, "i"), "append");
  assert.ok(!over.ok && /limit is 60/.test(over.error));
  assert.ok(mergeImported(mk(50, "e"), mk(11, "i"), "replace").ok);
});

test("summarizeBlocks counts types for the preview", () => {
  assert.equal(summarizeBlocks([{ type: "metricHero" }, { type: "cards" }, { type: "cards" }]), "3 blocks: metricHero, cards ×2");
  assert.equal(summarizeBlocks([{ type: "takeaway" }]), "1 block: takeaway");
});

test("a full case-study import validates end to end", () => {
  const list = [
    { type: "metricHero", data: { eyebrow: "Social media", label: "Monthly social reach", value: "+423%", from: "18,400", to: "96,300" } },
    { type: "factsStrip", data: { items: [{ label: "Client", value: "Acme" }, { label: "Timeframe", value: "6 months" }] } },
    { type: "cards", data: { variant: "stats", columns: 3, items: [{ title: "5.2×", text: "More reach" }] } },
    { type: "dataTable", data: table({ highlightLastColumn: true }) },
    { type: "proofGallery", data: { items: [{ imageUrl: "", caption: "coming soon" }] } },
    { type: "pullQuote", data: { quote: "" } },
    { type: "takeaway", data: { text: "Consistency compounds" } },
  ];
  const r = normalizeBlocksInput(withFreshIds(list));
  assert.ok(r.ok, JSON.stringify(r));
});
