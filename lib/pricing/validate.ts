// Admin-side validation + health warnings. Pure.

import { CURRENCY_CODES, isCurrencyCode } from "./currencies";
import { findInvalidPlaceholders, hasAdSpendToken } from "./text";
import { currencyHasPrice, resolveCurrencySettings } from "./visibility";
import type { RawPricing } from "./public";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PackageInput = {
  slug: string; number: string; name: string; tagline: string; description: string;
  isMostPopular: boolean; isActive: boolean;
  stages: [boolean, boolean, boolean, boolean, boolean];
  notIncluded: string; moveUpTitle: string; moveUpText: string; ctaLabel: string; ctaLink: string;
  prices: { currency: string; monthly: number | null; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[];
  features: { label: string; text: string }[];
};

const okMoney = (n: number | null) => n === null || (Number.isFinite(n) && n >= 0 && n <= 999_999_999_999);

/** Returns a list of error messages (empty = valid). */
export function validatePackageInput(p: PackageInput): string[] {
  const e: string[] = [];
  if (!SLUG_RE.test(p.slug)) e.push("Slug must be lowercase letters, numbers and hyphens.");
  if (!p.name.trim()) e.push("Name is required.");
  if (p.ctaLink && !/^(\/|https:\/\/)/.test(p.ctaLink)) e.push("CTA link must start with / or https://.");
  const seen = new Set<string>();
  for (const pr of p.prices) {
    if (!isCurrencyCode(pr.currency)) { e.push(`Unknown currency ${pr.currency}.`); continue; }
    if (seen.has(pr.currency)) e.push(`Duplicate ${pr.currency} price.`);
    seen.add(pr.currency);
    if (!okMoney(pr.monthly) || !okMoney(pr.setupFee) || !okMoney(pr.adSpendCap)) e.push(`${pr.currency}: amounts must be non-negative numbers.`);
  }
  const labels = new Set<string>();
  p.features.forEach((f, i) => {
    if (!f.label.trim()) e.push(`Feature row ${i + 1} needs a label.`);
    const k = f.label.trim().toLowerCase();
    if (labels.has(k)) e.push(`Duplicate feature label "${f.label}".`);
    labels.add(k);
    const bad = findInvalidPlaceholders(f.text);
    if (bad.length) e.push(`Feature "${f.label}": invalid placeholder ${bad.join(", ")} (only {adSpend} is allowed).`);
  });
  const badMove = findInvalidPlaceholders(p.moveUpText);
  if (badMove.length) e.push(`Move-up text: invalid placeholder ${badMove.join(", ")} (only {adSpend} is allowed).`);
  return e;
}

export type Warning = { level: "warning" | "info"; message: string };

/** Non-blocking health checks shown at the top of the Pricing admin. */
export function pricingWarnings(raw: RawPricing): Warning[] {
  const w: Warning[] = [];
  const currencies = resolveCurrencySettings(raw.currencies);
  for (const c of currencies) {
    if (c.isEnabled && !currencyHasPrice(c.code, raw.packages)) {
      w.push({ level: "warning", message: `${c.code} is enabled but no active package has an active price in it, so it is hidden on the public page.` });
    }
  }
  for (const p of raw.packages) {
    if (p.isActive && !p.prices.some((x) => x.isActive)) {
      w.push({ level: "warning", message: `Active package "${p.name}" has no active price in any currency.` });
    }
    const usesAd = hasAdSpendToken(p.moveUpText) || p.features.some((f) => hasAdSpendToken(f.text));
    if (usesAd) {
      for (const pr of p.prices) {
        if (pr.isActive && pr.adSpendCap === null) w.push({ level: "warning", message: `"${p.name}" uses {adSpend} but has no ad-spend cap in ${pr.currency}.` });
      }
      if (p.prices.length === 0) w.push({ level: "warning", message: `"${p.name}" uses {adSpend} but has no prices.` });
    }
  }
  const popular = raw.packages.filter((p) => p.isActive && p.isMostPopular);
  if (popular.length > 1) w.push({ level: "info", message: `${popular.length} packages are marked Most popular.` });
  return w;
}

export const SUPPORTED = CURRENCY_CODES;
