#!/usr/bin/env node
// Fails (exit 1) if any exported function in a "use server" file never runs
// an auth check. Server Actions can be called directly by id, so every
// export needs its own check (see lib/auth-guard.ts and lib/action-guard.ts).
//
// An export passes if its body calls one of AUTH_CALLS, or calls a function
// in the same file that does (e.g. runExport -> requireExport -> requirePermission).
// An action that is meant to be public (e.g. the public contact form) can opt
// out with a comment directly above it:  // auth-check: public — <reason>
//
// Usage: node scripts/check-server-action-auth.mjs

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "lib", "components"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".open-next", "generated"]);

// Calls that count as an auth check.
const AUTH_CALLS = new Set(["requireSession", "requirePermission", "guardMutation", "guardRead"]);
const OPT_OUT = /\/\/\s*auth-check:\s*public\b/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) yield full;
  }
}

function hasUseServerDirective(sf) {
  for (const stmt of sf.statements) {
    if (!ts.isExpressionStatement(stmt) || !ts.isStringLiteral(stmt.expression)) return false;
    if (stmt.expression.text === "use server") return true;
  }
  return false;
}

function isExported(node) {
  return ts.getModifiers?.(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

// Every function in the file with a body, by name, plus whether it's exported.
function collectFunctions(sf) {
  const fns = [];
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      fns.push({ name: stmt.name.text, body: stmt.body, exported: isExported(stmt), node: stmt });
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        if (ts.isIdentifier(decl.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          fns.push({ name: decl.name.text, body: init.body, exported: isExported(stmt), node: stmt });
        }
      }
    }
  }
  return fns;
}

function calledNames(body) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) names.add(callee.text);
      else if (ts.isPropertyAccessExpression(callee)) names.add(callee.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return names;
}

const failures = [];
let checkedFiles = 0;
let checkedExports = 0;

for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = [...walk(join(ROOT, dir))];
  } catch {
    continue;
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("use server")) continue;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    if (!hasUseServerDirective(sf)) continue;
    checkedFiles++;

    const fns = collectFunctions(sf);
    const calls = new Map(fns.map((f) => [f.name, calledNames(f.body)]));

    // Fixpoint: a function is guarded if it calls an auth check or a guarded local function.
    const guarded = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of fns) {
        if (guarded.has(f.name)) continue;
        const names = calls.get(f.name);
        if ([...names].some((n) => AUTH_CALLS.has(n) || guarded.has(n))) {
          guarded.add(f.name);
          changed = true;
        }
      }
    }

    const rel = relative(ROOT, file).replace(/\\/g, "/");
    const optedOut = (node) => OPT_OUT.test(text.slice(node.getFullStart(), node.getStart(sf)));
    const fail = (node, name) => {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      failures.push(`${rel}:${line + 1}  ${name}`);
    };

    for (const f of fns.filter((fn) => fn.exported)) {
      checkedExports++;
      if (!guarded.has(f.name) && !optedOut(f.node)) fail(f.node, f.name);
    }

    // `export { a, b as c }`, `export { x } from "./y"` and `export default ...`
    // expose functions too, so check those as well.
    for (const stmt of sf.statements) {
      if (ts.isExportDeclaration(stmt)) {
        if (stmt.isTypeOnly || optedOut(stmt)) continue;
        if (stmt.moduleSpecifier || !stmt.exportClause || !ts.isNamedExports(stmt.exportClause)) {
          // Re-exported from another module: can't see its body from here.
          checkedExports++;
          fail(stmt, `re-export from ${stmt.moduleSpecifier?.getText(sf) ?? "?"} (wrap it in a local guarded function)`);
          continue;
        }
        for (const el of stmt.exportClause.elements) {
          if (el.isTypeOnly) continue;
          checkedExports++;
          const local = (el.propertyName ?? el.name).text;
          if (!guarded.has(local)) fail(el, `${el.name.text}${el.propertyName ? ` (= ${local})` : ""}`);
        }
      } else if (ts.isExportAssignment(stmt) && !optedOut(stmt)) {
        checkedExports++;
        const expr = stmt.expression;
        if (!(ts.isIdentifier(expr) && guarded.has(expr.text))) fail(stmt, "default export");
      } else if (ts.isFunctionDeclaration(stmt) && !stmt.name && isExported(stmt) && stmt.body && !optedOut(stmt)) {
        checkedExports++;
        if (![...calledNames(stmt.body)].some((n) => AUTH_CALLS.has(n) || guarded.has(n))) fail(stmt, "default export");
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} Server Action export(s) with no auth check:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    `\nCall requireSession()/requirePermission() (lib/auth-guard.ts) or guardMutation()/guardRead()` +
      ` (lib/action-guard.ts) in each one.\nIf an action is meant to be public, put "// auth-check: public — <reason>" directly above it.\n`
  );
  process.exit(1);
}

console.log(`✔ ${checkedExports} Server Action exports in ${checkedFiles} "use server" files all run an auth check.`);
