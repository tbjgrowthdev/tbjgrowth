// Run with: npm test
//
// lib/native-lock.ts: the TBJ Admin app's biometric lock decisions, and the
// pre-paint script that hides admin pages until the person unlocks.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { ADMIN_UA_MARK, UNLOCKED_KEY, LOCK_ATTR, LOCK_INIT_SCRIPT, shouldLockOnLoad, backAction } from "@/lib/native-lock";

const ADMIN_UA = `Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36 ${ADMIN_UA_MARK}`;
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36";

test("shouldLockOnLoad locks the admin app until it was unlocked in this app run", () => {
  assert.equal(shouldLockOnLoad(ADMIN_UA, null), true);
  assert.equal(shouldLockOnLoad(ADMIN_UA, "1"), false);
});

test("shouldLockOnLoad never locks a normal browser or the client app", () => {
  assert.equal(shouldLockOnLoad(BROWSER_UA, null), false);
  assert.equal(shouldLockOnLoad(`${BROWSER_UA} SomethingElse`, null), false);
});

function runInitScript(ua: string, stored: string | null) {
  const dataset: Record<string, string> = {};
  const storage = new Map<string, string>(stored === null ? [] : [[UNLOCKED_KEY, stored]]);
  vm.runInNewContext(LOCK_INIT_SCRIPT, {
    navigator: { userAgent: ua },
    sessionStorage: { getItem: (k: string) => storage.get(k) ?? null },
    document: { documentElement: { setAttribute: (k: string, v: string) => (dataset[k] = v) } },
  });
  return dataset;
}

test("pre-paint script hides admin pages on a cold start or after the lock cleared the flag", () => {
  // A reload after lock() (push tap / Back while locked) has no flag either.
  assert.deepEqual(runInitScript(ADMIN_UA, null), { [LOCK_ATTR]: "1" });
});

test("pre-paint script leaves the page visible once unlocked, and in browsers", () => {
  assert.deepEqual(runInitScript(ADMIN_UA, "1"), {});
  assert.deepEqual(runInitScript(BROWSER_UA, null), {});
});

test("pre-paint script fails open on a storage error only outside the admin app", () => {
  const dataset: Record<string, string> = {};
  vm.runInNewContext(LOCK_INIT_SCRIPT, {
    navigator: { userAgent: ADMIN_UA },
    sessionStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
    },
    document: { documentElement: { setAttribute: (k: string, v: string) => (dataset[k] = v) } },
  });
  assert.deepEqual(dataset, { [LOCK_ATTR]: "1" }, "admin app stays locked when storage can't be read");
});

test("backAction ignores Back while locked", () => {
  assert.equal(backAction(true, true), "ignore");
  assert.equal(backAction(true, false), "ignore");
  assert.equal(backAction(false, true), "back");
  assert.equal(backAction(false, false), "exit");
});
