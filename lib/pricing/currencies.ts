// Built-in currency catalog. Lives in code so USD is available from day one
// without any database seeding; the admin only toggles/relabels/reorders.

export const CURRENCY_CODES = ["BDT", "GBP", "USD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type CurrencyDef = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** BCP-47 locale that decides digit grouping (informational). */
  locale: string;
  /** "indian" = 1,50,000 ; "standard" = 150,000 */
  grouping: "indian" | "standard";
  symbolPosition: "prefix" | "suffix";
  /** Short region tag used when several currencies share a policy line. */
  shortCode: string;
  defaultLabel: string;
  defaultOrder: number;
};

export const CURRENCY_CATALOG: Record<CurrencyCode, CurrencyDef> = {
  BDT: { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", locale: "en-IN", grouping: "indian", symbolPosition: "prefix", shortCode: "BD", defaultLabel: "Bangladesh · BDT", defaultOrder: 0 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", grouping: "standard", symbolPosition: "prefix", shortCode: "UK", defaultLabel: "United Kingdom · GBP", defaultOrder: 1 },
  USD: { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", grouping: "standard", symbolPosition: "prefix", shortCode: "US", defaultLabel: "United States · USD", defaultOrder: 2 },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

export function normalizeCurrencyCode(value: unknown): CurrencyCode | null {
  const v = String(value ?? "").trim().toUpperCase();
  return isCurrencyCode(v) ? v : null;
}

function groupDigits(intPart: string, grouping: "indian" | "standard"): string {
  if (intPart.length <= 3) return intPart;
  if (grouping === "standard") return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Plain grouped number, no symbol. Decimals only when the value has them (max 2). */
export function formatNumber(amount: number, code: CurrencyCode): string {
  const def = CURRENCY_CATALOG[code];
  const rounded = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  const [intPart, frac = ""] = rounded.toFixed(2).split(".");
  const grouped = groupDigits(intPart, def.grouping);
  return (amount < 0 ? "-" : "") + grouped + (frac === "00" ? "" : "." + frac);
}

/** e.g. formatMoney(150000, "BDT") -> "৳1,50,000" ; (995, "GBP") -> "£995". */
export function formatMoney(amount: number, code: CurrencyCode): string {
  const def = CURRENCY_CATALOG[code];
  const n = formatNumber(amount, code);
  return def.symbolPosition === "prefix" ? `${def.symbol}${n}` : `${n}${def.symbol}`;
}
