// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateImportDocument, suggestKey } from "../lib/case-study-import";
import { parseImportDocument, IMPORT_MAX_BYTES } from "../lib/blocks/import";
import { CASE_STUDY_IMPORT_KEYS, conflictingFields, isFilled, planFieldMerge } from "../lib/case-study-import-fields";

const takeaway = { type: "takeaway", data: { text: "Hi" } };
const full = {
  title: "Acme grows 4x",
  slug: "Acme Grows 4x",
  clientName: "Acme",
  industry: "Retail",
  serviceType: "Social media",
  results: "+423% reach",
  websiteUrl: "https://acme.example",
  excerpt: "How Acme grew.",
  featuredImage: "https://res.cloudinary.com/x/a.png",
  featuredImageAlt: "Acme dashboard",
  imageGallery: ["https://res.cloudinary.com/x/b.png", "/uploads/c.png"],
  isFeatured: true,
  metaTitle: "Acme case study",
  metaDescription: "desc",
  focusKeyword: "social media growth",
  secondaryKeywords: ["reach", "engagement", "reach"],
  canonicalUrl: "https://tbjgrowth.com/case-studies/acme",
  isIndexable: true,
  allowFollow: false,
  maxSnippet: 160,
  maxImagePreview: "standard",
  maxVideoPreview: -1,
  ogTitle: "og", ogDescription: "ogd", ogImage: "https://res.cloudinary.com/x/og.png",
  twitterCard: "summary_large_image", twitterTitle: "tw", twitterDescription: "twd", twitterImage: "/tw.png",
  schemaJson: { "@context": "https://schema.org", "@type": "Article", headline: "Acme" },
  blocks: [takeaway],
};

// ---------------------------------------------------------------- parsing (browser side)
test("parseImportDocument: bare list still works, object with fields and blocks works", () => {
  const list = parseImportDocument(JSON.stringify([takeaway]));
  assert.ok(list.ok && list.value.blocks?.length === 1 && Object.keys(list.value.fields).length === 0);
  const doc = parseImportDocument(JSON.stringify({ title: "T", blocks: [takeaway] }));
  assert.ok(doc.ok && doc.value.blocks?.length === 1 && doc.value.fields.title === "T");
  const fieldsOnly = parseImportDocument(JSON.stringify({ title: "T" }));
  assert.ok(fieldsOnly.ok && fieldsOnly.value.blocks === null);
});

test("parseImportDocument: clear errors, nothing loaded", () => {
  for (const bad of ["", "{oops", "42", '"x"', "null", "{}", "[]", JSON.stringify({ blocks: "x" }), JSON.stringify({ blocks: [] })]) {
    assert.equal(parseImportDocument(bad).ok, false, bad);
  }
  const big = parseImportDocument(JSON.stringify({ excerpt: "x".repeat(IMPORT_MAX_BYTES) }));
  assert.ok(!big.ok && /limit/.test(big.error));
  const many = parseImportDocument(JSON.stringify({ blocks: Array.from({ length: 61 }, () => takeaway) }));
  assert.ok(!many.ok && /at most 60/.test(many.error));
});

// ---------------------------------------------------------------- validation (server side)
test("a complete case study document validates and is normalized", () => {
  const r = validateImportDocument(full, "caseStudy");
  assert.ok(r.ok, JSON.stringify(r));
  if (!r.ok) return;
  assert.equal(r.fields.slug, "acme-grows-4x");
  assert.deepEqual(r.fields.secondaryKeywords, ["reach", "engagement"]); // trimmed, de-duplicated
  assert.equal(typeof r.fields.schemaJson, "string");
  assert.equal(JSON.parse(r.fields.schemaJson as string)["@type"], "Article");
  assert.equal(r.fields.isFeatured, true);
  assert.equal(r.fields.maxSnippet, 160);
  assert.equal(r.blocks?.length, 1);
  assert.ok(r.warnings.some((w) => /slug/.test(w) && /normalized/.test(w)));
  for (const key of Object.keys(r.fields)) assert.ok(CASE_STUDY_IMPORT_KEYS.includes(key), key);
});

test("status and bookkeeping fields are never imported, with a clear warning", () => {
  const r = validateImportDocument({ title: "T", status: "PUBLISHED", id: "x", publishedAt: "2026-01-01" }, "caseStudy");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal("status" in r.fields, false);
  assert.equal("id" in r.fields, false);
  assert.ok(r.warnings.some((w) => /status/.test(w) && /Draft/.test(w)));
  assert.ok(r.warnings.some((w) => /publishedAt/.test(w)));
});

test("unknown or misspelled fields are warnings with a suggestion, not silently ignored", () => {
  const r = validateImportDocument({ title: "T", clientname: "Acme", cleintName: "Acme", madeUp: 1, metaDesc: "x" }, "caseStudy");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.fields.clientName, undefined);
  assert.ok(r.warnings.some((w) => /clientname/.test(w) && /did you mean “clientName”/.test(w)));
  assert.ok(r.warnings.some((w) => /cleintName/.test(w) && /clientName/.test(w)));
  assert.ok(r.warnings.some((w) => /madeUp/.test(w) && !/did you mean/.test(w)));
  assert.equal(suggestKey("metaDesc"), "metaDescription");
});

test("first error names the field; nothing is returned on error", () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ title: 5 }, /^title: must be text/],
    [{ title: "x".repeat(201) }, /^title: too long/],
    [{ isFeatured: "yes" }, /^isFeatured: must be true or false/],
    [{ maxSnippet: 1.5 }, /^maxSnippet/],
    [{ maxSnippet: -2 }, /^maxSnippet/],
    [{ maxImagePreview: "huge" }, /^maxImagePreview/],
    [{ twitterCard: "poster" }, /^twitterCard/],
    [{ websiteUrl: "javascript:alert(1)" }, /^websiteUrl/],
    [{ websiteUrl: "acme.example" }, /^websiteUrl/],
    [{ canonicalUrl: "/relative" }, /^canonicalUrl/],
    [{ featuredImage: "javascript:alert(1)" }, /^featuredImage/],
    [{ featuredImage: "data:image/svg+xml,<svg/>" }, /^featuredImage/],
    [{ ogImage: "//evil.example/a.png" }, /^ogImage/],
    [{ twitterImage: "ftp://x/a.png" }, /^twitterImage/],
    [{ imageGallery: ["https://res.cloudinary.com/x/a.png", "javascript:alert(1)"] }, /^imageGallery\[2\]/],
    [{ imageGallery: "https://x/a.png" }, /^imageGallery: must be a list/],
    [{ imageGallery: Array.from({ length: 21 }, (_, i) => `/a${i}.png`) }, /^imageGallery: at most 20/],
    [{ secondaryKeywords: [1] }, /^secondaryKeywords/],
    [{ slug: "!!!" }, /^slug/],
    [{ schemaJson: "{not json" }, /^schemaJson: not valid JSON/],
    [{ schemaJson: "42" }, /^schemaJson/],
    [{ schemaJson: '{"a":"</script><script>alert(1)</script>"}' }, /^schemaJson: must not contain/],
    [{ title: "ok", blocks: [{ type: "takeaway", data: {} }] }, /^Block 1 \(takeaway\)/],
    [{ blocks: [{ type: "script", data: {} }] }, /unknown block type/],
    [{ blocks: "nope" }, /^blocks: must be a list/],
  ];
  for (const [doc, re] of cases) {
    const r = validateImportDocument(doc, "caseStudy");
    assert.ok(!r.ok && re.test(r.error), `${JSON.stringify(doc).slice(0, 80)} -> ${JSON.stringify(r).slice(0, 160)}`);
  }
});

test("unsafe block content in a combined file is still rejected / sanitized", () => {
  const bad = validateImportDocument({ blocks: [{ type: "cta", data: { heading: "x", buttonLabel: "y", buttonHref: "javascript:alert(1)" } }] }, "caseStudy");
  assert.equal(bad.ok, false);
  const rich = validateImportDocument({ content: "<p>hi</p><script>alert(1)</script>", blocks: [{ type: "richText", data: { html: "<p onclick=x()>a</p>" } }] }, "caseStudy");
  assert.ok(rich.ok);
  if (!rich.ok) return;
  assert.ok(!/script/i.test(String(rich.fields.content)));
  assert.ok(!/onclick/i.test(JSON.stringify(rich.blocks)));
});

test("images that parse but are on a host the site can't display produce a warning, not an error", () => {
  const r = validateImportDocument({ featuredImage: "https://elsewhere.example/a.png", imageGallery: ["https://elsewhere.example/b.png"] }, "caseStudy");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.warnings.filter((w) => /doesn't display/.test(w)).length, 2);
});

test("imported block ids are never trusted: missing or duplicate ids don't fail the import", () => {
  const r = validateImportDocument({ blocks: [{ id: "dup", ...takeaway }, { id: "dup", ...takeaway }, takeaway] }, "caseStudy");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(new Set(r.blocks?.map((b) => b.id)).size, 3);
  assert.ok(!r.blocks?.some((b) => b.id === "dup"));
});

test("a bare block list is a valid import for both targets (existing behaviour)", () => {
  for (const target of ["blocks", "caseStudy"] as const) {
    const r = validateImportDocument([takeaway, takeaway], target);
    assert.ok(r.ok && r.blocks?.length === 2 && Object.keys(r.fields).length === 0, target);
  }
});

test("pages and pSEO templates (target: blocks) take only blocks and say what was ignored", () => {
  const r = validateImportDocument({ title: "T", slug: "s", clientName: "C", status: "PUBLISHED", extra: 1, blocks: [takeaway] }, "blocks");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.fields, {});
  assert.equal(r.blocks?.length, 1);
  assert.ok(r.warnings.some((w) => /title/.test(w) && /only applies to case studies/.test(w)));
  assert.ok(r.warnings.some((w) => /status/.test(w)));
  assert.ok(r.warnings.some((w) => /extra/.test(w)));
  // Invalid values in ignored fields don't matter (they are not applied).
  assert.ok(validateImportDocument({ title: 42, blocks: [takeaway] }, "blocks").ok);
  // Fields only, no blocks: nothing to apply.
  const none = validateImportDocument({ title: "T" }, "blocks");
  assert.ok(!none.ok && /only takes blocks/.test(none.error));
});

test("an empty or useless document is an error, an empty blocks list is a warning", () => {
  assert.equal(validateImportDocument({}, "caseStudy").ok, false);
  assert.equal(validateImportDocument({ nothingUseful: 1 }, "caseStudy").ok, false);
  const r = validateImportDocument({ title: "T", blocks: [] }, "caseStudy");
  assert.ok(r.ok && r.blocks === null && r.warnings.some((w) => /empty list/.test(w)));
  assert.equal(validateImportDocument("string", "caseStudy").ok, false);
  assert.equal(validateImportDocument(null, "caseStudy").ok, false);
});

// ---------------------------------------------------------------- merging into the form
const formState = { title: "Existing", clientName: "", industry: "  ", imageGallery: [], secondaryKeywords: ["a"], isFeatured: false, isIndexable: true, allowFollow: true, maxSnippet: -1, maxImagePreview: "large" };

test("isFilled: strings/lists by content, booleans/numbers/enums by difference from the form's defaults", () => {
  assert.equal(isFilled("title", "x"), true);
  assert.equal(isFilled("title", "  "), false);
  assert.equal(isFilled("imageGallery", []), false);
  assert.equal(isFilled("imageGallery", ["/a.png"]), true);
  assert.equal(isFilled("isFeatured", false), false);
  assert.equal(isFilled("isFeatured", true), true);
  assert.equal(isFilled("allowFollow", true), false);
  assert.equal(isFilled("allowFollow", false), true);
  assert.equal(isFilled("maxSnippet", -1), false);
  assert.equal(isFilled("maxSnippet", 50), true);
  assert.equal(isFilled("maxImagePreview", "large"), false);
});

test("planFieldMerge: overwrite applies everything; fill-empty keeps filled fields; absent fields are never touched", () => {
  const incoming = { title: "New", clientName: "Acme", industry: "Retail", secondaryKeywords: ["b"], isFeatured: true };
  assert.deepEqual(conflictingFields(formState, incoming).sort(), ["secondaryKeywords", "title"]);
  const over = planFieldMerge(formState, incoming, "overwrite");
  assert.deepEqual(over.apply, incoming);
  const fill = planFieldMerge(formState, incoming, "fill-empty");
  assert.deepEqual(fill.apply, { clientName: "Acme", industry: "Retail", isFeatured: true });
  assert.deepEqual(fill.skipped.sort(), ["secondaryKeywords", "title"]);
  // Same value as already in the form is not a conflict.
  assert.deepEqual(conflictingFields(formState, { title: "Existing" }), []);
  assert.equal("excerpt" in over.apply, false);
});

// ---------------------------------------------------------------- docs stay honest
test("the example in docs/landing-page-blocks.md validates with no warnings", () => {
  const doc = readFileSync(new URL("../docs/landing-page-blocks.md", import.meta.url), "utf8");
  const match = /### Example\s+```json\r?\n([\s\S]*?)\r?\n```/.exec(doc);
  assert.ok(match, "example block not found");
  const parsed = parseImportDocument(match[1]);
  assert.ok(parsed.ok, JSON.stringify(parsed));
  const r = validateImportDocument(JSON.parse(match[1]), "caseStudy");
  assert.ok(r.ok, JSON.stringify(r));
  if (r.ok) {
    assert.deepEqual(r.warnings, []);
    assert.equal(r.blocks?.length, 7);
    assert.equal(r.fields.slug, "acme-social-reach");
  }
});
