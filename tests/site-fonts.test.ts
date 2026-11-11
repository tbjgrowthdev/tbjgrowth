// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { SITE_FONTS, normalizeFontKey, buildFontStack, siteFontCss, fontsFor } from "@/lib/site-fonts";

test("only known fonts of the right script are accepted; unknown, injected or non-string values become null", () => {
  assert.equal(normalizeFontKey("jost", "body", "latin"), "jost");
  assert.equal(normalizeFontKey("hind-siliguri", "body", "bengali"), "hind-siliguri");
  assert.equal(normalizeFontKey("hind-siliguri", "body", "latin"), null); // Bengali font in a Latin slot
  assert.equal(normalizeFontKey("jost", "body", "bengali"), null);
  assert.equal(normalizeFontKey("nope", "heading", "latin"), null);
  assert.equal(normalizeFontKey("inter;}body{display:none", "body", "latin"), null);
  assert.equal(normalizeFontKey(42, "body", "latin"), null);
  assert.equal(normalizeFontKey(null, "heading", "bengali"), null);
});

test("display-only fonts are heading-only, in both scripts", () => {
  assert.equal(normalizeFontKey("anton", "heading", "latin"), "anton");
  assert.equal(normalizeFontKey("anton", "body", "latin"), null);
  assert.equal(normalizeFontKey("baloo-da-2", "body", "bengali"), null);
  assert.ok(!fontsFor("bengali", "body").some((f) => f.headingOnly));
});

test("several Bengali fonts are offered", () => {
  assert.ok(SITE_FONTS.filter((f) => f.script === "bengali").length >= 4);
});

test("English and Bengali choices are independent", () => {
  const stack = buildFontStack("playfair-display", "hind-siliguri", "heading");
  assert.ok(stack.startsWith("var(--font-playfair), var(--font-hind)"), stack);
  // Changing only the Bengali font keeps the English one first, and vice versa.
  assert.ok(buildFontStack("playfair-display", "anek-bangla", "heading").startsWith("var(--font-playfair), var(--font-anek)"));
  assert.ok(buildFontStack("jost", "hind-siliguri", "heading").startsWith("var(--font-jost), var(--font-hind)"));
});

test("every stack always ends in the bundled Bengali and Arabic faces", () => {
  for (const latin of SITE_FONTS.filter((f) => f.script === "latin")) {
    for (const bn of SITE_FONTS.filter((f) => f.script === "bengali")) {
      const stack = buildFontStack(latin.key, bn.key, "heading");
      assert.ok(stack.includes("var(--font-bn)") && stack.includes("var(--font-ar)") && stack.includes("var(--font-inter)"), stack);
    }
  }
});

test("nothing chosen = exactly the previous look (Syne/Inter, Noto Sans Bengali)", () => {
  assert.ok(buildFontStack(null, null, "heading").startsWith("var(--font-syne), var(--font-bn)"));
  assert.ok(buildFontStack(undefined, undefined, "body").startsWith("var(--font-inter), var(--font-bn)"));
  assert.equal(buildFontStack("garbage", "garbage", "body"), buildFontStack(null, null, "body"));
  assert.equal(siteFontCss(null), siteFontCss({}));
});

test("generated CSS is one safe rule", () => {
  const css = siteFontCss({ headingFont: "playfair-display", bodyFontBn: "hind-siliguri" });
  assert.match(css, /^html:root\{--font-heading:var\(--font-playfair\)/);
  assert.match(css, /--font-body:var\(--font-inter\), var\(--font-hind\)/);
  assert.ok(!siteFontCss({ headingFont: "x</style><script>", bodyFont: "y" }).includes("<"));
});
