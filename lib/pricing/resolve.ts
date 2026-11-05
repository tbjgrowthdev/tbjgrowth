import { CURRENCY_CATALOG, type CurrencyCode } from "./currencies";

export type PolicyInput = { key: string; title: string; text: string; overrides: Record<string, string> };
export type PolicyEntry = { code: string | null; text: string };

/**
 * Per-currency wording with default fallback. If every visible currency ends up
 * with the same text it is shown once (code null). Otherwise each distinct
 * currency is listed with its region code ("UK: ..", "BD: ..").
 */
export function resolvePolicyEntries(policy: PolicyInput, visible: CurrencyCode[]): PolicyEntry[] {
  const def = (policy.text ?? "").trim();
  const perCurrency = visible
    .map((code) => ({ code, text: (policy.overrides[code] ?? "").trim() || def }))
    .filter((e) => e.text);
  if (perCurrency.length === 0) return def ? [{ code: null, text: def }] : [];
  const distinct = new Set(perCurrency.map((e) => e.text));
  if (distinct.size === 1) return [{ code: null, text: perCurrency[0].text }];
  return perCurrency.map((e) => ({ code: CURRENCY_CATALOG[e.code].shortCode, text: e.text }));
}

/** One footnote per visible currency, falling back to the default; de-duplicated, empties dropped. */
export function resolveFootnotes(footnotes: Record<string, string>, visible: CurrencyCode[]): string[] {
  const def = (footnotes[""] ?? "").trim();
  const list = visible.length ? visible.map((c) => (footnotes[c] ?? "").trim() || def) : [def];
  const out: string[] = [];
  for (const t of list) if (t && !out.includes(t)) out.push(t);
  return out;
}
