// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isDisplayableImageUrl, isImportableImageUrl } from "../lib/image-hosts";
import { isValidImageSrc } from "../lib/utils";

test("same-site paths and allowed https hosts are displayable", () => {
  assert.equal(isDisplayableImageUrl("/images/logo.png"), true);
  assert.equal(isDisplayableImageUrl("https://res.cloudinary.com/demo/image/upload/a.jpg"), true);
  assert.equal(isDisplayableImageUrl("https://images.unsplash.com/photo-1"), true);
});

test("other hosts, plain http and junk are not displayable (next/image would throw)", () => {
  assert.equal(isDisplayableImageUrl("https://example.com/a.png"), false);
  assert.equal(isDisplayableImageUrl("http://res.cloudinary.com/a.jpg"), false);
  assert.equal(isDisplayableImageUrl("//evil.example/a.png"), false);
  assert.equal(isDisplayableImageUrl("placeholder_url"), false);
  assert.equal(isDisplayableImageUrl("JD"), false);
  assert.equal(isValidImageSrc("https://example.com/a.png"), false);
  assert.equal(isValidImageSrc(undefined), false);
});

test("any absolute http(s) URL can be imported into the Media Library", () => {
  assert.equal(isImportableImageUrl("https://example.com/a.png"), true);
  assert.equal(isImportableImageUrl("http://example.com/a.png"), true);
  assert.equal(isImportableImageUrl("ftp://example.com/a.png"), false);
  assert.equal(isImportableImageUrl("/local.png"), false);
});
