// Run with: npm test
import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";

const shown: { kind: string; title: string; description?: string }[] = [];
const fakeToast = {
  success: (title: string, opts?: { description?: string }) => void shown.push({ kind: "success", title, description: opts?.description }),
  error: (title: string, opts?: { description?: string }) => void shown.push({ kind: "error", title, description: opts?.description }),
  info: (title: string, opts?: { description?: string }) => void shown.push({ kind: "info", title, description: opts?.description }),
};
mock.module("@/lib/admin/toast-store", { namedExports: { toast: fakeToast } });

const { withToast } = await import("../lib/admin/toast");
const msgs = { success: "Post updated", error: "Couldn't update post" };

beforeEach(() => {
  shown.length = 0;
});

test("success result: returned unchanged, success toast", async () => {
  const result = { success: true, data: { id: "p1" } };
  assert.equal(await withToast(Promise.resolve(result), msgs), result);
  assert.deepEqual(shown, [{ kind: "success", title: "Post updated", description: undefined }]);
});

test("{ success: false } result: returned unchanged, error toast with the action's error", async () => {
  const result = { success: false, error: "A post with this slug already exists" };
  assert.equal(await withToast(Promise.resolve(result), msgs), result);
  assert.deepEqual(shown, [{ kind: "error", title: "Couldn't update post", description: "A post with this slug already exists" }]);
});

test("thrown error (dropped connection): error toast, then re-thrown so the caller's catch still runs", async () => {
  const boom = new TypeError("network error");
  await assert.rejects(withToast(Promise.reject(boom), msgs), boom);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].kind, "error");
  assert.match(shown[0].description ?? "", /Lost connection/);
});

test("success: null shows nothing on success but still reports failures", async () => {
  await withToast(Promise.resolve({ success: true }), { success: null, error: "Couldn't save FAQs" });
  assert.equal(shown.length, 0);
  await withToast(Promise.resolve({ success: false }), { success: null, error: "Couldn't save FAQs" });
  assert.deepEqual(shown, [{ kind: "error", title: "Couldn't save FAQs", description: undefined }]);
});

test("results without a success flag (void, data) count as success", async () => {
  await withToast(Promise.resolve(undefined), msgs);
  await withToast(Promise.resolve({ created: 3, skipped: 0 }), { success: "Redirects imported", error: "x" });
  assert.deepEqual(shown.map((s) => s.title), ["Post updated", "Redirects imported"]);
});
