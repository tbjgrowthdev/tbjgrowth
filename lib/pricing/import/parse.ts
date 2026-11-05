// Step 1 of import: raw cell matrices -> typed rows + validation issues.
// Pure (no DB). Reference checks against existing data happen in plan.ts.

import { normalizeCurrencyCode, type CurrencyCode } from "../currencies";
import { IGNORED_SHEETS, LIMITS, SETTING_KEYS, SHEET_SPECS, matchSheetName, normHeader, type SheetName } from "./sheets";

export type RawWorkbook = Record<string, string[][]>;
export type Issue = { level: "error" | "warning"; sheet: string; row: number | null; message: string };

export type ParsedPackage = { slug: string; row: number; fields: Record<string, string | boolean | number | undefined> };
export type ParsedWorkbook = {
  settings: { key: string; currency: string; value: string; row: number }[];
  currencies: { code: CurrencyCode; label?: string; enabled?: boolean; sortOrder?: number; row: number }[];
  packages: ParsedPackage[];
  prices: { slug: string; currency: CurrencyCode; monthly: number; setup: number | null; adCap: number | null; active: boolean; row: number }[];
  features: { slug: string; label: string; text: string | undefined; sortOrder: number | undefined; row: number }[];
  comparison: { label: string; order: number | undefined; slug: string; text: string; row: number }[];
  policies: { key: string; title: string | undefined; sortOrder: number | undefined; currency: CurrencyCode | ""; text: string; row: number }[];
  presentSheets: SheetName[];
  issues: Issue[];
};

/** Strips control chars; undoes the export-side formula-injection guard (leading ' before = + - @). */
export function cleanCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (/^'[=+\-@\t\r]/.test(s)) s = s.slice(1);
  return s;
}

export function parseBool(v: string): boolean | null {
  const t = v.trim().toLowerCase();
  if (["true", "yes", "1", "y"].includes(t)) return true;
  if (["false", "no", "0", "n"].includes(t)) return false;
  return null;
}

/** Plain number, thousands separators tolerated; symbols/letters rejected. */
export function parseMoney(v: string): number | "invalid" | "negative" | null {
  const t = v.trim();
  if (!t) return null;
  if (/^-/.test(t)) return /^-[\d.,]+$/.test(t) ? "negative" : "invalid";
  if (!/^\d{1,3}(,\d{2,3})*(\.\d+)?$/.test(t) && !/^\d+(\.\d+)?$/.test(t)) return "invalid";
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n) || n > 999_999_999_999) return "invalid";
  return Math.round(n * 100) / 100;
}

function parseIntCell(v: string): number | "invalid" | null {
  if (!v.trim()) return null;
  return /^-?\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : "invalid";
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type SheetRows = { header: Map<string, number>; rows: { n: number; cells: string[] }[] };

function readSheet(name: SheetName, matrix: string[][], issues: Issue[]): SheetRows | null {
  const spec = SHEET_SPECS[name];
  if (matrix.length > LIMITS.maxRowsPerSheet + 1) {
    issues.push({ level: "error", sheet: name, row: null, message: `Too many rows (max ${LIMITS.maxRowsPerSheet}).` });
    return null;
  }
  const headerRow = matrix[0] ?? [];
  const header = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = normHeader(h);
    if (!key) return;
    if (header.has(key)) issues.push({ level: "error", sheet: name, row: 1, message: `Duplicate column "${key}".` });
    else header.set(key, i);
  });
  const known = new Set(spec.columns.map((c) => c.name));
  for (const key of header.keys()) {
    if (!known.has(key)) issues.push({ level: "warning", sheet: name, row: 1, message: `Unknown column "${key}" ignored.` });
  }
  let missing = false;
  for (const c of spec.columns) {
    if (c.required && !header.has(c.name)) {
      issues.push({ level: "error", sheet: name, row: 1, message: `Missing required column "${c.name}".` });
      missing = true;
    }
  }
  if (missing) return null;
  const rows: SheetRows["rows"] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = (matrix[i] ?? []).map((c) => {
      const s = cleanCell(c);
      return s;
    });
    if (cells.every((c) => !c)) continue; // ignore empty rows
    if (cells.some((c) => c.length > LIMITS.maxCellChars)) {
      issues.push({ level: "error", sheet: name, row: i + 1, message: `A cell is longer than ${LIMITS.maxCellChars} characters.` });
      continue;
    }
    rows.push({ n: i + 1, cells });
  }
  return { header, rows };
}

export function parseWorkbook(raw: RawWorkbook): ParsedWorkbook {
  const issues: Issue[] = [];
  const out: ParsedWorkbook = { settings: [], currencies: [], packages: [], prices: [], features: [], comparison: [], policies: [], presentSheets: [], issues };

  const sheets = new Map<SheetName, string[][]>();
  for (const [rawName, matrix] of Object.entries(raw)) {
    const key = rawName.trim().toLowerCase();
    if (IGNORED_SHEETS.includes(key)) continue;
    const name = matchSheetName(rawName);
    if (!name) {
      issues.push({ level: "warning", sheet: rawName, row: null, message: "Unknown sheet ignored." });
      continue;
    }
    if (sheets.has(name)) {
      issues.push({ level: "error", sheet: rawName, row: null, message: "Sheet appears more than once." });
      continue;
    }
    sheets.set(name, matrix);
  }
  if (sheets.size === 0) {
    issues.push({ level: "error", sheet: "", row: null, message: "No importable sheets found. Expected: Settings, Currencies, Packages, Prices, Features, ComparisonRows, Policies." });
  }

  const get = (s: SheetRows, cells: string[], col: string): string => {
    const i = s.header.get(col);
    return i === undefined ? "" : cells[i] ?? "";
  };
  const has = (s: SheetRows, col: string) => s.header.has(col);
  const err = (sheet: SheetName, row: number, message: string) => issues.push({ level: "error", sheet, row, message });

  for (const [name, matrix] of sheets) {
    const sh = readSheet(name, matrix, issues);
    if (!sh) continue;
    out.presentSheets.push(name);

    const seen = new Set<string>();
    const dup = (key: string, row: number) => {
      if (seen.has(key)) { err(name, row, `Duplicate key "${key}" in this sheet.`); return true; }
      seen.add(key);
      return false;
    };

    for (const { n, cells } of sh.rows) {
      const g = (c: string) => get(sh, cells, c);
      const bool = (col: string, dflt: boolean | undefined): boolean | undefined => {
        if (!has(sh, col)) return undefined;
        const v = g(col);
        if (!v) return dflt;
        const b = parseBool(v);
        if (b === null) { err(name, n, `"${col}" must be TRUE/FALSE (or yes/no/1/0), got "${v}".`); return dflt; }
        return b;
      };
      const int = (col: string): number | undefined => {
        if (!has(sh, col)) return undefined;
        const v = parseIntCell(g(col));
        if (v === "invalid") { err(name, n, `"${col}" must be a whole number, got "${g(col)}".`); return undefined; }
        return v ?? undefined;
      };
      const currencyCell = (required: boolean): CurrencyCode | "" | null => {
        const v = g("currency");
        if (!v) { if (required) { err(name, n, 'Missing "currency".'); return null; } return ""; }
        const c = normalizeCurrencyCode(v);
        if (!c) { err(name, n, `Unknown currency "${v}" (use BDT, GBP or USD).`); return null; }
        return c;
      };

      if (name === "Settings") {
        const key = g("key").toLowerCase();
        if (!(SETTING_KEYS as readonly string[]).includes(key)) { err(name, n, `Unknown setting key "${g("key")}".`); continue; }
        const cur = has(sh, "currency") ? currencyCell(false) : "";
        if (cur === null) continue;
        if (cur && key !== "footnote") { err(name, n, `Only "footnote" can be set per currency (key "${key}").`); continue; }
        if (dup(`${key}|${cur}`, n)) continue;
        out.settings.push({ key, currency: cur, value: g("value"), row: n });
      } else if (name === "Currencies") {
        const code = normalizeCurrencyCode(g("code"));
        if (!code) { err(name, n, `Unknown currency "${g("code")}" (use BDT, GBP or USD).`); continue; }
        if (dup(code, n)) continue;
        out.currencies.push({ code, label: has(sh, "label") ? g("label") : undefined, enabled: bool("enabled", true), sortOrder: int("sort_order"), row: n });
      } else if (name === "Packages") {
        const slug = g("slug");
        if (!SLUG_RE.test(slug)) { err(name, n, `Invalid slug "${slug}" (lowercase letters, numbers, hyphens).`); continue; }
        if (dup(slug, n)) continue;
        if (!g("name")) { err(name, n, 'Missing "name".'); continue; }
        const f: ParsedPackage["fields"] = {};
        const text = (col: string, field: string) => { if (has(sh, col)) f[field] = g(col); };
        f.name = g("name");
        text("number", "number"); text("tagline", "tagline"); text("description", "description");
        text("not_included", "notIncluded"); text("move_up_title", "moveUpTitle"); text("move_up_text", "moveUpText");
        text("cta_label", "ctaLabel"); text("cta_link", "ctaLink");
        if (has(sh, "cta_link") && g("cta_link") && !/^(\/|https:\/\/)/.test(g("cta_link"))) err(name, n, `"cta_link" must start with / or https://.`);
        const flags: [string, string, boolean][] = [["most_popular", "isMostPopular", false], ["active", "isActive", true], ["stage_build", "stageBuild", false], ["stage_attract", "stageAttract", false], ["stage_convert", "stageConvert", false], ["stage_automate", "stageAutomate", false], ["stage_scale", "stageScale", false]];
        for (const [col, field, dflt] of flags) { const b = bool(col, dflt); if (b !== undefined) f[field] = b; }
        const so = int("sort_order"); if (so !== undefined) f.sortOrder = so;
        out.packages.push({ slug, row: n, fields: f });
      } else if (name === "Prices") {
        const slug = g("package_slug");
        const cur = currencyCell(true);
        if (!slug || cur === null || cur === "") { if (!slug) err(name, n, 'Missing "package_slug".'); continue; }
        if (dup(`${slug}|${cur}`, n)) continue;
        const parse = (col: string, label: string) => {
          if (!has(sh, col)) return null;
          const v = parseMoney(g(col));
          if (v === "invalid") { err(name, n, `"${col}" must be a plain number (no currency symbols or text), got "${g(col)}".`); return "bad" as const; }
          if (v === "negative") { err(name, n, `"${col}" cannot be negative (${label}).`); return "bad" as const; }
          return v;
        };
        const monthly = parse("monthly", "monthly price");
        const setup = parse("setup", "setup fee");
        const adCap = parse("ad_cap", "ad-spend cap");
        if (monthly === "bad" || setup === "bad" || adCap === "bad") continue;
        if (monthly === null && setup === null && adCap === null) {
          issues.push({ level: "warning", sheet: name, row: n, message: `No numbers for ${slug} / ${cur}; skipped (no price in that currency).` });
          continue;
        }
        if (monthly === null) { err(name, n, `"monthly" is required when setup or ad_cap is given (${slug} / ${cur}).`); continue; }
        out.prices.push({ slug, currency: cur, monthly, setup, adCap, active: bool("active", true) ?? true, row: n });
      } else if (name === "Features") {
        const slug = g("package_slug"), label = g("label");
        if (!slug || !label) { err(name, n, 'Both "package_slug" and "label" are required.'); continue; }
        if (dup(`${slug}|${label.toLowerCase()}`, n)) continue;
        out.features.push({ slug, label, text: has(sh, "text") ? g("text") : undefined, sortOrder: int("sort_order"), row: n });
      } else if (name === "ComparisonRows") {
        const label = g("row_label"), slug = g("package_slug");
        if (!label || !slug) { err(name, n, 'Both "row_label" and "package_slug" are required.'); continue; }
        if (dup(`${label.toLowerCase()}|${slug}`, n)) continue;
        out.comparison.push({ label, order: int("row_order"), slug, text: g("text"), row: n });
      } else if (name === "Policies") {
        const key = g("policy_key");
        if (!key) { err(name, n, 'Missing "policy_key".'); continue; }
        const cur = has(sh, "currency") ? currencyCell(false) : "";
        if (cur === null) continue;
        if (dup(`${key.toLowerCase()}|${cur}`, n)) continue;
        out.policies.push({ key, title: has(sh, "title") ? g("title") : undefined, sortOrder: int("sort_order"), currency: cur, text: g("text"), row: n });
      }
    }
  }

  // A comparison row must have one consistent row_order across its lines.
  const orders = new Map<string, { order: number; row: number }>();
  for (const c of out.comparison) {
    if (c.order === undefined) continue;
    const k = c.label.toLowerCase();
    const prev = orders.get(k);
    if (prev && prev.order !== c.order) err("ComparisonRows", c.row, `Row "${c.label}" has conflicting row_order values (${prev.order} and ${c.order}).`);
    else if (!prev) orders.set(k, { order: c.order, row: c.row });
  }
  return out;
}
