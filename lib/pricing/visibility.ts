import { CURRENCY_CATALOG, CURRENCY_CODES, type CurrencyCode } from "./currencies";

export type CurrencySetting = { code: string; label?: string | null; isEnabled?: boolean | null; sortOrder?: number | null };
export type PriceInput = { currency: string; isActive: boolean };
export type PackageInput = { isActive: boolean; prices: PriceInput[] };

export type ResolvedCurrency = { code: CurrencyCode; label: string; isEnabled: boolean; sortOrder: number };

/** Catalog merged with admin settings. Missing settings => enabled, default label/order. */
export function resolveCurrencySettings(rows: CurrencySetting[]): ResolvedCurrency[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return CURRENCY_CODES.map((code) => {
    const def = CURRENCY_CATALOG[code];
    const row = byCode.get(code);
    return {
      code,
      label: row?.label?.trim() || def.defaultLabel,
      isEnabled: row ? row.isEnabled !== false : true,
      sortOrder: row?.sortOrder ?? def.defaultOrder,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder || CURRENCY_CODES.indexOf(a.code) - CURRENCY_CODES.indexOf(b.code));
}

/** Does at least one active package have an active price in this currency? */
export function currencyHasPrice(code: string, packages: PackageInput[]): boolean {
  return packages.some((p) => p.isActive && p.prices.some((pr) => pr.isActive && pr.currency === code));
}

/**
 * Public visibility rule: enabled AND at least one active package has an
 * active price in it. No price anywhere => the currency does not exist on the page.
 */
export function visibleCurrencies(settings: ResolvedCurrency[], packages: PackageInput[]): ResolvedCurrency[] {
  return settings.filter((c) => c.isEnabled && currencyHasPrice(c.code, packages));
}
