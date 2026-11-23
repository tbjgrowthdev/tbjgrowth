// Run with: npm test
//
// scripts/check-server-action-auth.mjs accepts each identity's guard only in
// its own area: requireClient only under app/(portal)/, the staff guards
// (requireSession, requirePermission, guardMutation, guardRead) everywhere
// else. Runs the real script against small fixture trees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SCRIPT = join(process.cwd(), "scripts", "check-server-action-auth.mjs");

function run(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "check-actions-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, `"use server";\n${body}\n`);
    }
    const r = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const usesClient = `export async function a() { await requireClient(); }`;
const usesStaff = `export async function a() { await requireSession(); }`;
const usesPerm = `export async function a() { await requirePermission("EDIT"); }`;

test("each guard passes in its own area", () => {
  const r = run({ "app/(portal)/actions/x.ts": usesClient, "app/(admin)/actions/y.ts": usesStaff, "lib/z.ts": usesPerm });
  assert.equal(r.code, 0, r.out);
});

test("a staff guard in a portal action is not an auth check", () => {
  const r = run({ "app/(portal)/actions/x.ts": usesStaff });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /app\/\(portal\)\/actions\/x\.ts/);
});

test("requireClient in a staff action is not an auth check", () => {
  for (const path of ["app/(admin)/actions/y.ts", "lib/z.ts"]) {
    const r = run({ [path]: usesClient });
    assert.equal(r.code, 1, `${path}: ${r.out}`);
  }
});
