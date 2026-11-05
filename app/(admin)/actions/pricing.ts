"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { loadRawPricing } from "@/lib/pricing/data";
import { buildPublicPricing, type PublicPricing, type RawPricing } from "@/lib/pricing/public";
import { isCurrencyCode, normalizeCurrencyCode } from "@/lib/pricing/currencies";
import { SLUG_RE, pricingWarnings, validatePackageInput, type PackageInput, type Warning } from "@/lib/pricing/validate";
import { parseWorkbook, type RawWorkbook } from "@/lib/pricing/import/parse";
import { planImport, type ImportMode, type Plan, type Snapshot } from "@/lib/pricing/import/plan";
import { applyPlan, loadSnapshot } from "@/lib/pricing/import/server";
import { exportSheets, templateSheets, type Matrix } from "@/lib/pricing/import/export";
import { LIMITS, SETTING_KEYS } from "@/lib/pricing/import/sheets";

type Ok<T = object> = { success: true } & T;
type Fail = { success: false; error: string };

const EMPTY_PUBLIC: PublicPricing = { hasContent: false, texts: { eyebrow: "", headline: "", intro: "", compareTitle: "", compareSubtitle: "", upfrontOffer: "", contractLine: "" }, currencies: [], packages: [], comparisonRows: [], policies: [], footnotes: [] };

function refresh() {
  revalidatePath("/admin/pricing");
  revalidatePath("/pricing");
  revalidatePath("/[locale]/pricing", "page");
}

async function guard<T>(label: string, fn: () => Promise<T>): Promise<T | Fail> {
  try {
    await requirePermission("PRICING_MANAGEMENT");
    return await fn();
  } catch (error: unknown) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Pricing: ${label} failed:`, error);
    const msg = error instanceof Error ? error.message : "";
    return { success: false, error: msg && !/prisma|invocation/i.test(msg) ? msg : `Couldn't ${label}` };
  }
}

const audit = (action: string, entityType: string, entityLabel: string, after?: unknown) =>
  logAudit({ action, category: "Content", entityType, entityLabel, after: after as Record<string, unknown> | undefined });

// ---------------------------------------------------------------- public read
// Consumed by the public /pricing page - stays unguarded.
// auth-check: public — public pricing page
export async function getPublicPricing(): Promise<PublicPricing> {
  try {
    return buildPublicPricing(await loadRawPricing());
  } catch (error) {
    console.error("Failed to load pricing:", error);
    return EMPTY_PUBLIC;
  }
}

// ---------------------------------------------------------------- admin reads
export type AdminPricing = { raw: RawPricing; warnings: Warning[] };

export async function getAdminPricing(): Promise<AdminPricing | null> {
  try {
    await requirePermission("PRICING_MANAGEMENT");
    const raw = await loadRawPricing();
    return { raw, warnings: pricingWarnings(raw) };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("Failed to load admin pricing:", error);
    return null;
  }
}

// ---------------------------------------------------------------- currencies
export async function saveCurrencies(items: { code: string; label: string; isEnabled: boolean; sortOrder: number }[]) {
  return guard<Ok | Fail>("save currencies", async () => {
    for (const c of items) {
      if (!isCurrencyCode(c.code)) return { success: false, error: `Unknown currency ${c.code}` };
      if (c.label.length > 120) return { success: false, error: "Label is too long" };
    }
    await Promise.all(items.map((c) =>
      prisma.pricingCurrency.upsert({
        where: { code: c.code },
        create: { code: c.code, label: c.label.trim(), isEnabled: !!c.isEnabled, sortOrder: Math.trunc(c.sortOrder) || 0 },
        update: { label: c.label.trim(), isEnabled: !!c.isEnabled, sortOrder: Math.trunc(c.sortOrder) || 0 },
      })));
    refresh();
    await audit("update", "PricingCurrency", "Currencies", items);
    return { success: true };
  });
}

// ---------------------------------------------------------------- packages
export async function savePackage(id: string | null, input: PackageInput) {
  return guard<Ok<{ id: string }> | Fail>("save package", async () => {
    const errors = validatePackageInput(input);
    if (errors.length) return { success: false, error: errors.join(" ") };

    const clash = await prisma.pricingPackage.findUnique({ where: { slug: input.slug } });
    if (clash && clash.id !== id) return { success: false, error: `Another package already uses the slug "${input.slug}".` };

    const fields = {
      slug: input.slug, number: input.number.trim(), name: input.name.trim(), tagline: input.tagline.trim(), description: input.description.trim(),
      isMostPopular: input.isMostPopular, isActive: input.isActive,
      stageBuild: input.stages[0], stageAttract: input.stages[1], stageConvert: input.stages[2], stageAutomate: input.stages[3], stageScale: input.stages[4],
      notIncluded: input.notIncluded.trim(), moveUpTitle: input.moveUpTitle.trim(), moveUpText: input.moveUpText.trim(),
      ctaLabel: input.ctaLabel.trim(), ctaLink: input.ctaLink.trim(),
    };
    let pkgId = id;
    if (id) {
      await prisma.pricingPackage.update({ where: { id }, data: fields });
    } else {
      const max = await prisma.pricingPackage.aggregate({ _max: { sortOrder: true } });
      const created = await prisma.pricingPackage.create({ data: { ...fields, sortOrder: (max._max.sortOrder ?? -1) + 1 } });
      pkgId = created.id;
    }
    const packageId = pkgId as string;

    // Prices: blank monthly = no price in that currency (row removed).
    await Promise.all(input.prices.map((p) => {
      const currency = normalizeCurrencyCode(p.currency) as string;
      if (p.monthly === null) return prisma.pricingPrice.deleteMany({ where: { packageId, currency } });
      const data = { monthly: p.monthly, setupFee: p.setupFee, adSpendCap: p.adSpendCap, isActive: p.isActive };
      return prisma.pricingPrice.upsert({ where: { packageId_currency: { packageId, currency } }, create: { packageId, currency, ...data }, update: data });
    }));

    // Features: replace the list (delete, then create in order).
    await prisma.pricingFeature.deleteMany({ where: { packageId } });
    await Promise.all(input.features.map((f, i) =>
      prisma.pricingFeature.create({ data: { packageId, label: f.label.trim(), text: f.text.trim(), sortOrder: i + 1 } })));

    refresh();
    await audit(id ? "update" : "create", "PricingPackage", input.name, { slug: input.slug, prices: input.prices, features: input.features.length });
    return { success: true, id: packageId };
  });
}

export async function reorderPackages(ids: string[]) {
  return guard<Ok | Fail>("reorder packages", async () => {
    await Promise.all(ids.map((id, i) => prisma.pricingPackage.update({ where: { id }, data: { sortOrder: i } })));
    refresh();
    await audit("update", "PricingPackage", "Reordered packages");
    return { success: true };
  });
}

export async function setPackageActive(id: string, isActive: boolean) {
  return guard<Ok | Fail>("update package", async () => {
    const p = await prisma.pricingPackage.update({ where: { id }, data: { isActive } });
    refresh();
    await audit("update", "PricingPackage", `${p.name} ${isActive ? "activated" : "deactivated"}`);
    return { success: true };
  });
}

export async function deletePackage(id: string) {
  return guard<Ok | Fail>("delete package", async () => {
    const p = await prisma.pricingPackage.delete({ where: { id } });
    refresh();
    await audit("delete", "PricingPackage", p.name);
    return { success: true };
  });
}

// ---------------------------------------------------------------- price matrix
export async function savePriceMatrix(cells: { packageId: string; currency: string; monthly: number | null; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[]) {
  return guard<Ok | Fail>("save prices", async () => {
    for (const c of cells) {
      if (!isCurrencyCode(c.currency)) return { success: false, error: `Unknown currency ${c.currency}` };
      for (const v of [c.monthly, c.setupFee, c.adSpendCap]) {
        if (v !== null && (!Number.isFinite(v) || v < 0 || v > 999_999_999_999)) return { success: false, error: "Amounts must be non-negative numbers." };
      }
    }
    await Promise.all(cells.map((c) => {
      if (c.monthly === null) return prisma.pricingPrice.deleteMany({ where: { packageId: c.packageId, currency: c.currency } });
      const data = { monthly: c.monthly, setupFee: c.setupFee, adSpendCap: c.adSpendCap, isActive: c.isActive };
      return prisma.pricingPrice.upsert({ where: { packageId_currency: { packageId: c.packageId, currency: c.currency } }, create: { packageId: c.packageId, currency: c.currency, ...data }, update: data });
    }));
    refresh();
    await audit("update", "PricingPrice", "Price matrix", { cells: cells.length });
    return { success: true };
  });
}

// ---------------------------------------------------------------- comparison rows
export async function saveComparisonRows(rows: { id: string | null; label: string; cells: Record<string, string> }[]) {
  return guard<Ok | Fail>("save comparison rows", async () => {
    const labels = new Set<string>();
    for (const r of rows) {
      const k = r.label.trim().toLowerCase();
      if (!k) return { success: false, error: "Every row needs a label." };
      if (labels.has(k)) return { success: false, error: `Duplicate row label "${r.label}".` };
      labels.add(k);
    }
    const keepIds: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const label = r.label.trim();
      const row = r.id
        ? await prisma.pricingComparisonRow.update({ where: { id: r.id }, data: { label, sortOrder: i + 1 } })
        : await prisma.pricingComparisonRow.upsert({ where: { label }, create: { label, sortOrder: i + 1 }, update: { sortOrder: i + 1 } });
      keepIds.push(row.id);
      await Promise.all(Object.entries(r.cells).map(([packageId, text]) =>
        prisma.pricingComparisonCell.upsert({ where: { rowId_packageId: { rowId: row.id, packageId } }, create: { rowId: row.id, packageId, text: text.trim() }, update: { text: text.trim() } })));
    }
    await prisma.pricingComparisonRow.deleteMany({ where: { id: { notIn: keepIds } } });
    refresh();
    await audit("update", "PricingComparisonRow", "Comparison rows", { rows: rows.length });
    return { success: true };
  });
}

// ---------------------------------------------------------------- policies
export async function savePolicies(policies: { id: string | null; key: string; title: string; text: string; overrides: Record<string, string> }[]) {
  return guard<Ok | Fail>("save policies", async () => {
    const keys = new Set<string>();
    for (const p of policies) {
      if (!SLUG_RE.test(p.key)) return { success: false, error: `Policy key "${p.key}" must be lowercase letters, numbers and hyphens.` };
      if (keys.has(p.key)) return { success: false, error: `Duplicate policy key "${p.key}".` };
      keys.add(p.key);
      if (!p.title.trim()) return { success: false, error: `Policy "${p.key}" needs a title.` };
    }
    const keepIds: string[] = [];
    for (let i = 0; i < policies.length; i++) {
      const p = policies[i];
      const data = { key: p.key, title: p.title.trim(), text: p.text.trim(), sortOrder: i + 1 };
      const row = p.id ? await prisma.pricingPolicy.update({ where: { id: p.id }, data }) : await prisma.pricingPolicy.upsert({ where: { key: p.key }, create: data, update: data });
      keepIds.push(row.id);
      await Promise.all(Object.entries(p.overrides).filter(([c]) => isCurrencyCode(c)).map(([currency, text]) => {
        const t = text.trim();
        if (!t) return prisma.pricingPolicyText.deleteMany({ where: { policyId: row.id, currency } });
        return prisma.pricingPolicyText.upsert({ where: { policyId_currency: { policyId: row.id, currency } }, create: { policyId: row.id, currency, text: t }, update: { text: t } });
      }));
    }
    await prisma.pricingPolicy.deleteMany({ where: { id: { notIn: keepIds } } });
    refresh();
    await audit("update", "PricingPolicy", "Policies", { count: policies.length });
    return { success: true };
  });
}

// ---------------------------------------------------------------- settings
export async function savePricingSettings(values: Record<string, string>, footnotes: Record<string, string>) {
  return guard<Ok | Fail>("save settings", async () => {
    const entries: { key: string; currency: string; value: string }[] = [];
    for (const [key, value] of Object.entries(values)) {
      if (!(SETTING_KEYS as readonly string[]).includes(key) || key === "footnote") continue;
      entries.push({ key, currency: "", value: value.trim() });
    }
    for (const [currency, value] of Object.entries(footnotes)) {
      if (currency !== "" && !isCurrencyCode(currency)) continue;
      entries.push({ key: "footnote", currency, value: value.trim() });
    }
    await Promise.all(entries.map((e) =>
      prisma.pricingSetting.upsert({ where: { key_currency: { key: e.key, currency: e.currency } }, create: e, update: { value: e.value } })));
    refresh();
    await audit("update", "PricingSetting", "Pricing texts");
    return { success: true };
  });
}

// ---------------------------------------------------------------- import / export
function checkPayload(raw: RawWorkbook): string | null {
  const sheets = Object.entries(raw ?? {});
  if (sheets.length === 0 || sheets.length > 20) return "The file has no importable sheets.";
  let cells = 0;
  for (const [, m] of sheets) {
    if (!Array.isArray(m) || m.length > LIMITS.maxRowsPerSheet + 1) return `A sheet has more than ${LIMITS.maxRowsPerSheet} rows.`;
    for (const r of m) { if (!Array.isArray(r) || r.length > 60) return "A sheet has too many columns."; cells += r.length; }
  }
  if (cells > 200_000) return "The file is too large.";
  return null;
}

export type ImportPreview = { plan: Omit<Plan, "upserts"> };

export async function previewPricingImport(raw: RawWorkbook, mode: ImportMode) {
  return guard<Ok<ImportPreview> | Fail>("preview import", async () => {
    const bad = checkPayload(raw);
    if (bad) return { success: false, error: bad };
    const plan = planImport(parseWorkbook(raw), await loadSnapshot(), mode === "replace" ? "replace" : "merge");
    const { upserts: _omit, ...rest } = plan;
    void _omit;
    return { success: true, plan: rest };
  });
}

export async function applyPricingImport(raw: RawWorkbook, mode: ImportMode) {
  return guard<Ok<ImportPreview> | Fail>("import pricing", async () => {
    const bad = checkPayload(raw);
    if (bad) return { success: false, error: bad };
    // Re-plan on the server against current data: the client never supplies the plan.
    const plan = planImport(parseWorkbook(raw), await loadSnapshot(), mode === "replace" ? "replace" : "merge");
    if (plan.errorCount > 0) return { success: false, error: `The file still has ${plan.errorCount} error(s). Nothing was imported.` };
    await applyPlan(plan);
    refresh();
    await audit("import", "Pricing", `${mode === "replace" ? "Replace all" : "Merge"} import`, plan.counts);
    const { upserts: _omit, ...rest } = plan;
    void _omit;
    return { success: true, plan: rest };
  });
}

export type ExportPayload = { sheets: { name: string; rows: Matrix }[] };

export async function exportPricingData() {
  return guard<Ok<ExportPayload> | Fail>("export pricing", async () => {
    const snap: Snapshot = await loadSnapshot();
    await audit("export", "Pricing", "Exported pricing data");
    return { success: true, sheets: exportSheets(snap) };
  });
}

export async function getPricingTemplate() {
  return guard<Ok<ExportPayload> | Fail>("build template", async () => ({ success: true, sheets: templateSheets() }));
}
