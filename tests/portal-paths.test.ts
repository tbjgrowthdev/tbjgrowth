// Run with: npm test
//
// safePortalPath (lib/portal/paths.ts): the only paths a push tap or a
// "from" redirect may open inside the Client Hub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { safePortalPath } from "../lib/portal/paths";

test("accepts portal paths", () => {
  assert.equal(safePortalPath("/portal"), "/portal");
  assert.equal(safePortalPath("/portal/projects/1"), "/portal/projects/1");
  assert.equal(safePortalPath("/portal/billing?tab=due"), "/portal/billing?tab=due");
});

test("rejects admin, external and script urls", () => {
  for (const bad of [
    "/admin",
    "/admin/clients",
    "//evil.com",
    "//evil.com/portal",
    "https://x",
    "https://tbjgrowthtech.com/portal",
    "javascript:alert(1)",
    "/portal/../admin",
    "/portal/%2e%2e/admin",
    "/portal\\..\\admin",
    "/\\evil.com",
    "/portalx",
    "/portal/\nx",
    "",
    "portal/projects",
  ]) {
    assert.equal(safePortalPath(bad), null, bad);
  }
});

test("rejects non-strings", () => {
  for (const bad of [undefined, null, 1, {}, ["/portal"]]) assert.equal(safePortalPath(bad), null);
});
