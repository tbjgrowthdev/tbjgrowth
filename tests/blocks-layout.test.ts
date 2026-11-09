// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseBlockData } from "../lib/blocks/schema";
import { blocksToText } from "../lib/blocks/text";
import { introIsBelow, isFootnoteHtml } from "../lib/blocks/visible";
import { BLOCK_FIELDS } from "../lib/blocks/fields";
import { defaultBlockData } from "../lib/blocks/types";

test("richText: eyebrow is optional plain text; old blocks without it still parse", () => {
  const old = parseBlockData("richText", { html: "<p>Hi</p>" });
  assert.ok(old.ok && (old.value as { eyebrow: string }).eyebrow === "");
  const withLabel = parseBlockData("richText", { eyebrow: "  The business challenge ", html: "<h2>Loved by regulars</h2>" });
  assert.ok(withLabel.ok && (withLabel.value as { eyebrow: string }).eyebrow === "The business challenge");
  assert.equal(parseBlockData("richText", { eyebrow: "x".repeat(121), html: "" }).ok, false);
  // HTML in the label is not interpreted: it is stored as text and rendered as a React text child.
  const tagged = parseBlockData("richText", { eyebrow: "<b>Label</b>", html: "" });
  assert.ok(tagged.ok);
  assert.ok(BLOCK_FIELDS.richText.some((f) => f.key === "eyebrow"));
  assert.equal((defaultBlockData("richText") as { eyebrow: string }).eyebrow, "");
});

test("richText eyebrow counts as page text for the SEO panel", () => {
  assert.match(blocksToText([{ type: "richText", data: { eyebrow: "The business challenge", html: "<p>Body</p>" } }]), /The business challenge/);
});

test("cards: introPlacement defaults to auto and rejects unknown values", () => {
  const d = parseBlockData("cards", { items: [{ title: "5.2×" }] });
  assert.ok(d.ok && (d.value as { introPlacement: string }).introPlacement === "auto");
  assert.equal(parseBlockData("cards", { introPlacement: "sideways", items: [] }).ok, false);
  assert.ok(parseBlockData("cards", { introPlacement: "below", items: [] }).ok);
  // structural field, not page copy
  assert.ok(!blocksToText([{ type: "cards", data: { introPlacement: "below", items: [] } }]).includes("below"));
});

test("introIsBelow: stat cards put the intro below by default; explicit choice wins", () => {
  assert.equal(introIsBelow("stats", "auto"), true);
  assert.equal(introIsBelow("stats", undefined), true);
  assert.equal(introIsBelow("default", "auto"), false);
  assert.equal(introIsBelow("steps", "auto"), false);
  assert.equal(introIsBelow("stats", "above"), false);
  assert.equal(introIsBelow("default", "below"), true);
});

test("proofGallery: intro is optional text and is page copy", () => {
  const d = parseBlockData("proofGallery", { items: [] });
  assert.ok(d.ok && (d.value as { intro: string }).intro === "");
  assert.equal(parseBlockData("proofGallery", { intro: "x".repeat(601), items: [] }).ok, false);
  assert.match(blocksToText([{ type: "proofGallery", data: { intro: "Real posts", items: [{ imageUrl: "/a.png", caption: "c" }] } }]), /Real posts/);
});

test("isFootnoteHtml: only a single short paragraph is a footnote", () => {
  assert.equal(isFootnoteHtml("<p><em>Results vary by business, offer and budget.</em></p>"), true);
  assert.equal(isFootnoteHtml("<p>Short.</p>\n"), true);
  assert.equal(isFootnoteHtml("<p>One</p><p>Two</p>"), false);
  assert.equal(isFootnoteHtml("<h2>Heading</h2><p>Text</p>"), false);
  assert.equal(isFootnoteHtml("<ul><li>a</li></ul>"), false);
  assert.equal(isFootnoteHtml("<p><img src=\"/a.png\"></p>"), false);
  assert.equal(isFootnoteHtml("<p></p>"), false);
  assert.equal(isFootnoteHtml(`<p>${"word ".repeat(60)}</p>`), false);
  assert.equal(isFootnoteHtml("plain text"), false);
});
