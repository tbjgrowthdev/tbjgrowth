// Step 2 of import: parsed rows + a snapshot of existing data -> a dry-run plan
// (create/update/unchanged counts, reference errors, concrete upserts).
// Pure: the snapshot is passed in, nothing is written here.

import { CURRENCY_CATALOG, CURRENCY_CODES, type CurrencyCode } from "../currencies";
import { findInvalidPlaceholders } from "../text";
import type { Issue, ParsedWorkbook } from "./parse";

export type PackageFields = {
  name: string; number: string; tagline: string; description: string;
  isMostPopular: boolean; isActive: boolean; sortOrder: number;
  stageBuild: boolean; stageAttract: boolean; stageConvert: boolean; stageAutomate: boolean; stageScale: boolean;
  notIncluded: string; moveUpTitle: string; moveUpText: string; ctaLabel: string; ctaLink: string;
};
export const PACKAGE_DEFAULTS: PackageFields = {
  name: "", number: "", tagline: "", description: "", isMostPopular: false, isActive: true, sortOrder: 0,
  stageBuild: false, stageAttract: false, stageConvert: false, stageAutomate: false, stageScale: false,
  notIncluded: "", moveUpTitle: "", moveUpText: "", ctaLabel: "", ctaLink: "",
};

export type Snapshot = {
  settings: { key: string; currency: string; value: string }[];
  currencies: { code: string; label: string; isEnabled: boolean; sortOrder: number }[];
  packages: ({ slug: string } & PackageFields)[];
  prices: { slug: string; currency: string; monthly: number; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[];
  features: { slug: string; label: string; text: string; sortOrder: number }[];
  rows: { label: string; sortOrder: number }[];
  cells: { label: string; slug: string; text: string }[];
  policies: { key: string; title: string; sortOrder: number; text: string }[];
  policyTexts: { key: string; currency: string; text: string }[];
};
export const EMPTY_SNAPSHOT: Snapshot = { settings: [], currencies: [], packages: [], prices: [], features: [], rows: [], cells: [], policies: [], policyTexts: [] };

export type EntityName = "settings" | "currencies" | "packages" | "prices" | "features" | "comparisonRows" | "comparisonCells" | "policies" | "policyTexts";
export const ENTITY_ORDER: EntityName[] = ["settings", "currencies", "packages", "prices", "features", "comparisonRows", "comparisonCells", "policies", "policyTexts"];
export type Counts = { create: number; update: number; unchanged: number; delete: number };

export type Upserts = {
  settings: { key: string; currency: string; value: string }[];
  currencies: { code: CurrencyCode; label: string; isEnabled: boolean; sortOrder: number }[];
  packages: ({ slug: string } & PackageFields)[];
  prices: { slug: string; currency: CurrencyCode; monthly: number; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[];
  features: { slug: string; label: string; text: string; sortOrder: number }[];
  rows: { label: string; sortOrder: number }[];
  cells: { label: string; slug: string; text: string }[];
  policies: { key: string; title: string; sortOrder: number; text: string }[];
  policyTexts: { key: string; currency: CurrencyCode; text: string }[];
};

export type ImportMode = "merge" | "replace";
export type Plan = {
  mode: ImportMode;
  counts: Record<EntityName, Counts>;
  upserts: Upserts;
  issues: Issue[];
  errorCount: number;
  warningCount: number;
};

const newCounts = (): Counts => ({ create: 0, update: 0, unchanged: 0, delete: 0 });

export function planImport(parsed: ParsedWorkbook, existingSnapshot: Snapshot, mode: ImportMode = "merge"): Plan {
  const snap = mode === "replace" ? EMPTY_SNAPSHOT : existingSnapshot;
  const issues: Issue[] = [...parsed.issues];
  const counts = Object.fromEntries(ENTITY_ORDER.map((e) => [e, newCounts()])) as Record<EntityName, Counts>;
  const up: Upserts = { settings: [], currencies: [], packages: [], prices: [], features: [], rows: [], cells: [], policies: [], policyTexts: [] };
  const err = (sheet: string, row: number | null, message: string) => issues.push({ level: "error", sheet, row, message });
  const warn = (sheet: string, row: number | null, message: string) => issues.push({ level: "warning", sheet, row, message });

  if (mode === "replace") {
    const c = existingSnapshot;
    counts.settings.delete = c.settings.length; counts.currencies.delete = c.currencies.length; counts.packages.delete = c.packages.length;
    counts.prices.delete = c.prices.length; counts.features.delete = c.features.length; counts.comparisonRows.delete = c.rows.length;
    counts.comparisonCells.delete = c.cells.length; counts.policies.delete = c.policies.length; counts.policyTexts.delete = c.policyTexts.length;
  }

  const apply = <T>(entity: EntityName, existing: T | undefined, next: T, equal: (a: T, b: T) => boolean, push: () => void) => {
    if (existing === undefined) { counts[entity].create++; push(); }
    else if (equal(existing, next)) counts[entity].unchanged++;
    else { counts[entity].update++; push(); }
  };

  // ---- Settings
  const settingMap = new Map(snap.settings.map((s) => [`${s.key}|${s.currency}`, s]));
  for (const s of parsed.settings) {
    const ex = settingMap.get(`${s.key}|${s.currency}`);
    if (!ex && !s.value) { counts.settings.unchanged++; continue; }
    apply("settings", ex, s, (a, b) => a.value === b.value, () => up.settings.push({ key: s.key, currency: s.currency, value: s.value }));
  }

  // ---- Currencies
  const curMap = new Map(snap.currencies.map((c) => [c.code, c]));
  parsed.currencies.forEach((c) => {
    const ex = curMap.get(c.code);
    const def = CURRENCY_CATALOG[c.code];
    const next = {
      code: c.code,
      label: c.label !== undefined ? c.label : ex?.label ?? "",
      isEnabled: c.enabled ?? ex?.isEnabled ?? true,
      sortOrder: c.sortOrder ?? ex?.sortOrder ?? def.defaultOrder,
    };
    apply("currencies", ex, next, (a, b) => a.label === b.label && a.isEnabled === b.isEnabled && a.sortOrder === b.sortOrder, () => up.currencies.push(next));
  });

  // ---- Packages
  const pkgMap = new Map(snap.packages.map((p) => [p.slug, p]));
  const knownSlugs = new Set(pkgMap.keys());
  let maxPkgOrder = Math.max(-1, ...snap.packages.map((p) => p.sortOrder));
  parsed.packages.forEach((p) => {
    knownSlugs.add(p.slug);
    const ex = pkgMap.get(p.slug);
    const base: PackageFields = ex ? { ...ex } : { ...PACKAGE_DEFAULTS };
    const next = { ...base, ...(p.fields as Partial<PackageFields>) } as PackageFields;
    if (!ex && p.fields.sortOrder === undefined) next.sortOrder = ++maxPkgOrder;
    for (const f of ["moveUpText"] as const) {
      const bad = findInvalidPlaceholders(next[f]);
      if (bad.length) err("Packages", p.row, `move_up_text has an invalid placeholder: ${bad.join(", ")} (only {adSpend} is allowed).`);
    }
    const eq = (a: PackageFields, b: PackageFields) => (Object.keys(PACKAGE_DEFAULTS) as (keyof PackageFields)[]).every((k) => a[k] === b[k]);
    apply("packages", ex as PackageFields | undefined, next, eq, () => up.packages.push({ slug: p.slug, ...next }));
  });

  // ---- Prices
  const priceMap = new Map(snap.prices.map((p) => [`${p.slug}|${p.currency}`, p]));
  for (const p of parsed.prices) {
    if (!knownSlugs.has(p.slug)) { err("Prices", p.row, `Unknown package "${p.slug}" (not in this file's Packages sheet or in saved data).`); continue; }
    const next = { slug: p.slug, currency: p.currency, monthly: p.monthly, setupFee: p.setup, adSpendCap: p.adCap, isActive: p.active };
    apply("prices", priceMap.get(`${p.slug}|${p.currency}`), next, (a, b) => a.monthly === b.monthly && a.setupFee === b.setupFee && a.adSpendCap === b.adSpendCap && a.isActive === b.isActive, () => up.prices.push(next));
  }

  // ---- Features
  const featMap = new Map(snap.features.map((f) => [`${f.slug}|${f.label.toLowerCase()}`, f]));
  const featCount = new Map<string, number>();
  for (const f of snap.features) featCount.set(f.slug, Math.max(featCount.get(f.slug) ?? 0, f.sortOrder));
  for (const f of parsed.features) {
    if (!knownSlugs.has(f.slug)) { err("Features", f.row, `Unknown package "${f.slug}".`); continue; }
    const ex = featMap.get(`${f.slug}|${f.label.toLowerCase()}`);
    let order = f.sortOrder ?? ex?.sortOrder;
    if (order === undefined) { order = (featCount.get(f.slug) ?? 0) + 1; featCount.set(f.slug, order); }
    const next = { slug: f.slug, label: ex ? ex.label : f.label, text: f.text ?? ex?.text ?? "", sortOrder: order };
    const bad = findInvalidPlaceholders(next.text);
    if (bad.length) err("Features", f.row, `Text has an invalid placeholder: ${bad.join(", ")} (only {adSpend} is allowed).`);
    apply("features", ex, next, (a, b) => a.text === b.text && a.sortOrder === b.sortOrder, () => up.features.push(next));
  }

  // ---- Comparison rows + cells
  const rowMap = new Map(snap.rows.map((r) => [r.label.toLowerCase(), r]));
  const cellMap = new Map(snap.cells.map((c) => [`${c.label.toLowerCase()}|${c.slug}`, c]));
  let maxRowOrder = Math.max(0, ...snap.rows.map((r) => r.sortOrder));
  const rowSeen = new Map<string, { label: string; order: number }>();
  for (const c of parsed.comparison) {
    if (!knownSlugs.has(c.slug)) { err("ComparisonRows", c.row, `Unknown package "${c.slug}".`); continue; }
    const k = c.label.toLowerCase();
    let r = rowSeen.get(k);
    if (!r) {
      const ex = rowMap.get(k);
      const order = c.order ?? ex?.sortOrder ?? ++maxRowOrder;
      r = { label: ex ? ex.label : c.label, order };
      rowSeen.set(k, r);
      apply("comparisonRows", ex, { label: r.label, sortOrder: r.order }, (a, b) => a.sortOrder === b.sortOrder, () => up.rows.push({ label: r!.label, sortOrder: r!.order }));
    }
    const exCell = cellMap.get(`${k}|${c.slug}`);
    if (!exCell && !c.text) { counts.comparisonCells.unchanged++; continue; }
    apply("comparisonCells", exCell, c, (a, b) => a.text === b.text, () => up.cells.push({ label: r!.label, slug: c.slug, text: c.text }));
  }

  // ---- Policies
  const polMap = new Map(snap.policies.map((p) => [p.key.toLowerCase(), p]));
  const polTextMap = new Map(snap.policyTexts.map((t) => [`${t.key.toLowerCase()}|${t.currency}`, t]));
  let maxPolOrder = Math.max(0, ...snap.policies.map((p) => p.sortOrder));
  const defaults = new Map(parsed.policies.filter((p) => p.currency === "").map((p) => [p.key.toLowerCase(), p]));
  const polSeen = new Set<string>();
  for (const p of parsed.policies) {
    const k = p.key.toLowerCase();
    const ex = polMap.get(k);
    const def = defaults.get(k);
    if (!polSeen.has(k)) {
      polSeen.add(k);
      if (!ex && !def) { err("Policies", p.row, `Policy "${p.key}" has currency overrides but no default (blank-currency) line and does not exist yet.`); continue; }
      if (def) {
        const title = def.title ?? ex?.title ?? "";
        if (!title) { err("Policies", def.row, `Policy "${p.key}" needs a title.`); continue; }
        const next = { key: ex ? ex.key : def.key, title, sortOrder: def.sortOrder ?? ex?.sortOrder ?? ++maxPolOrder, text: def.text };
        apply("policies", ex, next, (a, b) => a.title === b.title && a.sortOrder === b.sortOrder && a.text === b.text, () => up.policies.push(next));
      } else {
        counts.policies.unchanged++;
      }
    }
    if (p.currency) {
      const exT = polTextMap.get(`${k}|${p.currency}`);
      if (!exT && !p.text) { counts.policyTexts.unchanged++; continue; }
      const key = ex ? ex.key : (defaults.get(k)?.key ?? p.key);
      apply("policyTexts", exT, p, (a, b) => a.text === b.text, () => up.policyTexts.push({ key, currency: p.currency as CurrencyCode, text: p.text }));
    }
  }

  // ---- Post-import sanity warnings (final state)
  const finalPkgs = new Map<string, PackageFields>();
  for (const p of snap.packages) finalPkgs.set(p.slug, p);
  for (const p of up.packages) finalPkgs.set(p.slug, p);
  const finalPrices = new Map<string, { slug: string; currency: string; isActive: boolean }>();
  for (const p of snap.prices) finalPrices.set(`${p.slug}|${p.currency}`, p);
  for (const p of up.prices) finalPrices.set(`${p.slug}|${p.currency}`, p);
  const finalCur = new Map<string, boolean>();
  for (const c of snap.currencies) finalCur.set(c.code, c.isEnabled);
  for (const c of up.currencies) finalCur.set(c.code, c.isEnabled);
  for (const [slug, pkg] of finalPkgs) {
    if (pkg.isActive && ![...finalPrices.values()].some((x) => x.slug === slug && x.isActive)) warn("Prices", null, `Active package "${slug}" has no price in any currency.`);
  }
  for (const code of CURRENCY_CODES) {
    if ((finalCur.get(code) ?? true) && parsed.presentSheets.includes("Currencies") && parsed.currencies.some((c) => c.code === code)) {
      const anyPrice = [...finalPrices.values()].some((x) => x.currency === code && x.isActive && finalPkgs.get(x.slug)?.isActive);
      if (!anyPrice) warn("Currencies", null, `${code} is enabled but no active package has a price in it, so it will not show on the page.`);
    }
  }

  return {
    mode, counts, upserts: up, issues,
    errorCount: issues.filter((i) => i.level === "error").length,
    warningCount: issues.filter((i) => i.level === "warning").length,
  };
}
