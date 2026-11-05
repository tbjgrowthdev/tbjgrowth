// Snapshot -> sheet matrices in exactly the import format (so export/edit/re-import
// round-trips), plus the template's Instructions and Examples sheets.
// Pure; the xlsx/csv file encoding happens in the browser (client-files.ts).

import { rowsToCsv } from "@/lib/csv";
import { SHEET_NAMES, SHEET_SPECS, type SheetName } from "./sheets";
import type { Snapshot } from "./plan";

export type Cell = string | number;
export type Matrix = Cell[][];

/** Spreadsheet formula-injection guard: text starting with = + - @ (or tab/CR) gets a leading apostrophe. */
export function safeCell(v: Cell | null | undefined): Cell {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const bool = (b: boolean) => (b ? "TRUE" : "FALSE");
const header = (sheet: SheetName) => SHEET_SPECS[sheet].columns.map((c) => c.name);
const numOrBlank = (n: number | null) => (n === null ? "" : n);

export function snapshotToSheets(s: Snapshot): Record<SheetName, Matrix> {
  const out = {} as Record<SheetName, Matrix>;
  const slugOrder = new Map(s.packages.map((p) => [p.slug, p.sortOrder]));
  const bySlug = (a: string, b: string) => (slugOrder.get(a) ?? 0) - (slugOrder.get(b) ?? 0) || a.localeCompare(b);

  out.Settings = [header("Settings"), ...[...s.settings].sort((a, b) => a.key.localeCompare(b.key) || a.currency.localeCompare(b.currency)).map((x) => [x.key, x.currency, x.value])];
  out.Currencies = [header("Currencies"), ...[...s.currencies].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => [c.code, c.label, bool(c.isEnabled), c.sortOrder])];
  out.Packages = [header("Packages"), ...[...s.packages].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => [
    p.slug, p.number, p.name, p.tagline, p.description, bool(p.isMostPopular), bool(p.isActive), p.sortOrder,
    bool(p.stageBuild), bool(p.stageAttract), bool(p.stageConvert), bool(p.stageAutomate), bool(p.stageScale),
    p.notIncluded, p.moveUpTitle, p.moveUpText, p.ctaLabel, p.ctaLink,
  ])];
  out.Prices = [header("Prices"), ...[...s.prices].sort((a, b) => bySlug(a.slug, b.slug) || a.currency.localeCompare(b.currency)).map((p) => [p.slug, p.currency, p.monthly, numOrBlank(p.setupFee), numOrBlank(p.adSpendCap), bool(p.isActive)])];
  out.Features = [header("Features"), ...[...s.features].sort((a, b) => bySlug(a.slug, b.slug) || a.sortOrder - b.sortOrder).map((f) => [f.slug, f.label, f.text, f.sortOrder])];
  const rowOrder = new Map(s.rows.map((r) => [r.label, r.sortOrder]));
  out.ComparisonRows = [header("ComparisonRows"), ...[...s.cells].sort((a, b) => (rowOrder.get(a.label) ?? 0) - (rowOrder.get(b.label) ?? 0) || bySlug(a.slug, b.slug)).map((c) => [c.label, rowOrder.get(c.label) ?? 0, c.slug, c.text])];
  const pol = [...s.policies].sort((a, b) => a.sortOrder - b.sortOrder);
  const polRows: Matrix = [];
  for (const p of pol) {
    polRows.push([p.key, p.title, p.sortOrder, "", p.text]);
    for (const t of s.policyTexts.filter((x) => x.key === p.key).sort((a, b) => a.currency.localeCompare(b.currency))) polRows.push([p.key, "", "", t.currency, t.text]);
  }
  out.Policies = [header("Policies"), ...polRows];

  for (const name of SHEET_NAMES) out[name] = out[name].map((row, i) => (i === 0 ? row : row.map(safeCell)));
  return out;
}

/** Instructions: one row per column with sheet, column, required, description. */
export function instructionsSheet(): Matrix {
  const rows: Matrix = [
    ["Pricing import template"],
    ["Fill the sheets named below. Header names are fixed (case-insensitive). The Instructions and Examples sheets are never imported."],
    ["Rows are matched to existing records by their key; import creates missing records and updates existing ones, and never deletes unless you choose Replace all."],
    ["TRUE/FALSE columns accept true/false/yes/no/1/0. Prices are plain numbers (no currency symbols). Empty rows are ignored."],
    [],
    ["Sheet", "Column", "Required", "Description"],
  ];
  for (const name of SHEET_NAMES) {
    const spec = SHEET_SPECS[name];
    rows.push([name, "", "", spec.summary]);
    for (const c of spec.columns) rows.push(["", c.name, c.required ? "yes" : "no", c.description]);
  }
  return rows;
}

export function examplesSheet(): Matrix {
  const rows: Matrix = [["These rows are illustrations only and are NOT imported. Copy the pattern into the real sheets."], []];
  for (const name of SHEET_NAMES) {
    const spec = SHEET_SPECS[name];
    rows.push([name]);
    rows.push(spec.columns.map((c) => c.name));
    for (const ex of spec.examples) rows.push(ex);
    rows.push([]);
  }
  return rows;
}

export function templateSheets(): { name: string; rows: Matrix }[] {
  return [
    { name: "Instructions", rows: instructionsSheet() },
    ...SHEET_NAMES.map((n) => ({ name: n as string, rows: [header(n)] as Matrix })),
    { name: "Examples", rows: examplesSheet() },
  ];
}

export function exportSheets(s: Snapshot): { name: string; rows: Matrix }[] {
  const m = snapshotToSheets(s);
  return SHEET_NAMES.map((n) => ({ name: n as string, rows: m[n] }));
}

export function sheetToCsv(rows: Matrix): string {
  const [head, ...body] = rows;
  const cols = head.map(String);
  return rowsToCsv(cols, body.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? ""]))));
}
