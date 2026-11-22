// Run with: npm test
//
// Client Hub permissions (lib/permissions.ts): CLIENT_MANAGEMENT is full
// control of clients, CLIENT_UPDATES is the narrower "post updates and
// reports" right that EDITOR also gets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../lib/permissions";

test("CLIENT_MANAGEMENT only for SUPER_ADMIN and ADMIN", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "CLIENT_MANAGEMENT"), true);
  assert.equal(hasPermission("ADMIN", "CLIENT_MANAGEMENT"), true);
  assert.equal(hasPermission("EDITOR", "CLIENT_MANAGEMENT"), false);
  assert.equal(hasPermission("SEO_MANAGER", "CLIENT_MANAGEMENT"), false);
  assert.equal(hasPermission("CONTRIBUTOR", "CLIENT_MANAGEMENT"), false);
});

test("CLIENT_UPDATES for SUPER_ADMIN, ADMIN and EDITOR only", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "CLIENT_UPDATES"), true);
  assert.equal(hasPermission("ADMIN", "CLIENT_UPDATES"), true);
  assert.equal(hasPermission("EDITOR", "CLIENT_UPDATES"), true);
  assert.equal(hasPermission("SEO_MANAGER", "CLIENT_UPDATES"), false);
  assert.equal(hasPermission("CONTRIBUTOR", "CLIENT_UPDATES"), false);
});

test("an unknown role such as CLIENT gets no client permissions", () => {
  assert.equal(hasPermission("CLIENT", "CLIENT_UPDATES"), false);
  assert.equal(hasPermission("CLIENT", "CLIENT_MANAGEMENT"), false);
});
