import prisma from "@/lib/prisma";
import type { RawPricing } from "./public";

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Loads all pricing rows as plain objects (Decimal -> number). Works on an empty database. */
export async function loadRawPricing(): Promise<RawPricing> {
  const [currencies, packages, rows, policies, settings] = await Promise.all([
    prisma.pricingCurrency.findMany(),
    prisma.pricingPackage.findMany({ include: { prices: true, features: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pricingComparisonRow.findMany({ include: { cells: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pricingPolicy.findMany({ include: { overrides: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pricingSetting.findMany(),
  ]);

  const settingsMap: Record<string, Record<string, string>> = {};
  for (const s of settings) (settingsMap[s.key] ??= {})[s.currency] = s.value;

  return {
    currencies,
    packages: packages.map((p) => ({
      ...p,
      prices: p.prices.map((x) => ({ currency: x.currency, monthly: num(x.monthly), setupFee: numOrNull(x.setupFee), adSpendCap: numOrNull(x.adSpendCap), isActive: x.isActive })),
      features: p.features.map((f) => ({ label: f.label, text: f.text, sortOrder: f.sortOrder })),
    })),
    comparisonRows: rows.map((r) => ({ id: r.id, label: r.label, sortOrder: r.sortOrder, cells: r.cells.map((c) => ({ packageId: c.packageId, text: c.text })) })),
    policies: policies.map((p) => ({ id: p.id, key: p.key, title: p.title, sortOrder: p.sortOrder, text: p.text, overrides: p.overrides.map((o) => ({ currency: o.currency, text: o.text })) })),
    settings: settingsMap,
  };
}
