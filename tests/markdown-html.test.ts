// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownishToHtml, looksLikeMarkdown } from "../lib/markdown-html";
import { sanitizeRichText } from "../lib/sanitize";

test("Markdown markers inside <p> tags become real headings and bold", () => {
  const html = markdownishToHtml(
    "<p>Intro text.</p><p>## 1. Optimize for Search Intent, Not Just Keywords</p><p>Use <strong>BOFU</strong> terms and **proof**.</p>"
  );
  assert.match(html, /<h2>1\. Optimize for Search Intent, Not Just Keywords<\/h2>/);
  assert.match(html, /<strong>proof<\/strong>/);
  assert.doesNotMatch(html, /##/);
});

test("consecutive '- ' paragraphs become one list", () => {
  const html = markdownishToHtml("<p>- one</p><p>- two</p><p>after</p>");
  assert.equal(html, "<ul><li>one</li><li>two</li></ul><p>after</p>");
});

test("a whole body of Markdown is converted, with soft-wrapped lines joined", () => {
  const html = markdownishToHtml("# Title\n\nFirst line\nsecond line.\n\n1. a\n2. b\n\n> quoted");
  assert.equal(
    html,
    "<h1>Title</h1><p>First line second line.</p><ol><li>a</li><li>b</li></ol><blockquote><p>quoted</p></blockquote>"
  );
});

test("clean HTML is returned unchanged (idempotent)", () => {
  const clean = "<h2>Heading</h2><p>Text with <a href=\"/x\">a link</a>.</p><ul><li>a</li></ul>";
  assert.equal(looksLikeMarkdown(clean), false);
  assert.equal(markdownishToHtml(clean), clean);
  const once = markdownishToHtml("<p>## H</p>");
  assert.equal(markdownishToHtml(once), once);
});

test("a lone numbered paragraph is not turned into a list", () => {
  assert.equal(markdownishToHtml("<p>**Note**</p><p>1. Only one</p>"), "<p><strong>Note</strong></p><p>1. Only one</p>");
});

test("scripts and unsafe links do not survive conversion + sanitizing", () => {
  const evil = markdownishToHtml("## Hi <script>alert(1)</script>\n\n[x](https://a.com/\"onmouseover=alert(1))\n\n<img src=x onerror=alert(1)>");
  const safe = sanitizeRichText(evil);
  assert.doesNotMatch(safe, /<script|<img/i);
  // the only tags with attributes are the link, and it carries just href + rel
  assert.deepEqual(safe.match(/<[a-z][^>]*\s[^>]*>/gi), ['<a href="https://a.com/%22onmouseover=alert(1" rel="noopener noreferrer">']);
  const js = sanitizeRichText(markdownishToHtml("[click](javascript:alert(1))"));
  assert.doesNotMatch(js, /href=/i); // not turned into a link at all
});
