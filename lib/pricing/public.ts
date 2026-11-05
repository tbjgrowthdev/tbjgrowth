// Pure builder: raw DB rows (plain numbers/strings) -> the view-model the public
// /pricing page renders. No Prisma here so it is unit-testable.

import { CURRENCY_CATALOG, formatMoney, type CurrencyCode } from "./currencies";
import { resolveCurrencySettings, visibleCurrencies, type CurrencySetting } from "./visibility";
import { resolveFootnotes, resolvePolicyEntries, type PolicyEntry } from "./resolve";
import { applyAdSpend } from "./text";

export type RawPrice = { currency: string; monthly: number; setupFee: number | null; adSpendCap: number | null; isActive: boolean };
export type RawPackage = {
  id: string; slug: string; number: string; name: string; tagline: string; description: string;
  isMostPopular: boolean; isActive: boolean; sortOrder: number;
  stageBuild: boolean; stageAttract: boolean; stageConvert: boolean; stageAutomate: boolean; stageScale: boolean;
  notIncluded: string; moveUpTitle: string; moveUpText: string; ctaLabel: string; ctaLink: string;
  prices: RawPrice[];
  features: { label: string; text: string; sortOrder: number }[];
};
export type RawComparisonRow = { id?: string; label: string; sortOrder: number; cells: { packageId: string; text: string }[] };
export type RawPolicy = { id?: string; key: string; title: string; sortOrder: number; text: string; overrides: { currency: string; text: string }[] };
export type RawPricing = {
  currencies: CurrencySetting[];
  packages: RawPackage[];
  comparisonRows: RawComparisonRow[];
  policies: RawPolicy[];
  /** key -> currency("" = default) -> value */
  settings: Record<string, Record<string, string>>;
};

export type PublicMoneyLine = { code: CurrencyCode; label: string; monthly: string; monthlyValue: number; setup: string | null; setupValue: number | null; adCap: string | null; adCapValue: number | null };
export type PublicPackage = {
  slug: string; number: string; name: string; tagline: string; description: string; isMostPopular: boolean;
  stages: boolean[]; // Build, Attract, Convert, Automate, Scale
  prices: PublicMoneyLine[];
  features: { label: string; text: string }[];
  notIncluded: string; moveUpTitle: string; moveUpText: string;
  ctaLabel: string; ctaLink: string;
};
export type PublicPricing = {
  hasContent: boolean;
  texts: { eyebrow: string; headline: string; intro: string; compareTitle: string; compareSubtitle: string; upfrontOffer: string; contractLine: string };
  currencies: { code: CurrencyCode; label: string; symbol: string }[];
  packages: PublicPackage[];
  comparisonRows: { label: string; cells: Record<string, string> }[];
  policies: { key: string; title: string; entries: PolicyEntry[] }[];
  footnotes: string[];
};

export const STAGE_LABELS = ["Build", "Attract", "Convert", "Automate", "Scale"] as const;

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

export function buildPublicPricing(raw: RawPricing): PublicPricing {
  const activePackages = raw.packages.filter((p) => p.isActive).sort(bySort);
  const visible = visibleCurrencies(resolveCurrencySettings(raw.currencies), raw.packages);
  const visibleCodes = visible.map((c) => c.code);

  const packages: PublicPackage[] = activePackages.map((p) => {
    const prices: PublicMoneyLine[] = [];
    for (const cur of visible) {
      const pr = p.prices.find((x) => x.currency === cur.code && x.isActive);
      if (!pr) continue;
      prices.push({
        code: cur.code, label: cur.label,
        monthly: formatMoney(pr.monthly, cur.code), monthlyValue: pr.monthly,
        setup: pr.setupFee != null ? formatMoney(pr.setupFee, cur.code) : null, setupValue: pr.setupFee,
        adCap: pr.adSpendCap != null ? formatMoney(pr.adSpendCap, cur.code) : null, adCapValue: pr.adSpendCap,
      });
    }
    // {adSpend} -> every visible currency's cap for this package, e.g. "£1,000 / ৳60,000".
    const caps = prices.map((x) => x.adCap).filter((x): x is string => !!x);
    const adSpend = caps.length ? caps.join(" / ") : null;
    return {
      slug: p.slug, number: p.number, name: p.name, tagline: p.tagline, description: p.description,
      isMostPopular: p.isMostPopular,
      stages: [p.stageBuild, p.stageAttract, p.stageConvert, p.stageAutomate, p.stageScale],
      prices,
      features: [...p.features].sort(bySort).map((f) => ({ label: f.label, text: applyAdSpend(f.text, adSpend) })),
      notIncluded: p.notIncluded, moveUpTitle: p.moveUpTitle, moveUpText: applyAdSpend(p.moveUpText, adSpend),
      ctaLabel: p.ctaLabel, ctaLink: p.ctaLink,
    };
  });

  const idToSlug = new Map(activePackages.map((p) => [p.id, p.slug]));
  const comparisonRows = [...raw.comparisonRows].sort(bySort).map((r) => {
    const cells: Record<string, string> = {};
    for (const c of r.cells) {
      const slug = idToSlug.get(c.packageId);
      if (slug && c.text.trim()) cells[slug] = c.text;
    }
    return { label: r.label, cells };
  }).filter((r) => Object.keys(r.cells).length > 0);

  const policies = [...raw.policies].sort(bySort).map((p) => ({
    key: p.key, title: p.title,
    entries: resolvePolicyEntries(
      { key: p.key, title: p.title, text: p.text, overrides: Object.fromEntries(p.overrides.map((o) => [o.currency, o.text])) },
      visibleCodes,
    ),
  })).filter((p) => p.entries.length > 0);

  const s = (key: string) => (raw.settings[key]?.[""] ?? "").trim();
  return {
    hasContent: packages.length > 0 && visible.length > 0,
    texts: {
      eyebrow: s("eyebrow"), headline: s("headline"), intro: s("intro"),
      compareTitle: s("compare_title"), compareSubtitle: s("compare_subtitle"),
      upfrontOffer: s("upfront_offer"), contractLine: s("contract_line"),
    },
    currencies: visible.map((c) => ({ code: c.code, label: c.label, symbol: CURRENCY_CATALOG[c.code].symbol })),
    packages,
    comparisonRows,
    policies,
    footnotes: resolveFootnotes(raw.settings["footnote"] ?? {}, visibleCodes),
  };
}
