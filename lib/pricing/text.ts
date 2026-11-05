// {adSpend} placeholder handling. Only this one token is allowed in
// admin-authored pricing text; any other {braces} are flagged by validation.

export const AD_SPEND_TOKEN = "{adSpend}";

export function hasAdSpendToken(text: string | null | undefined): boolean {
  return !!text && text.includes(AD_SPEND_TOKEN);
}

/** Returns brace tokens other than {adSpend} (e.g. "{adspend}" typos) and unbalanced braces. */
export function findInvalidPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = text.match(/\{[^{}]*\}/g) ?? [];
  const bad = found.filter((t) => t !== AD_SPEND_TOKEN);
  const stripped = text.replace(/\{[^{}]*\}/g, "");
  if (/[{}]/.test(stripped)) bad.push("unbalanced { }");
  return [...new Set(bad)];
}

/**
 * Replaces {adSpend}. `replacement` is already formatted (possibly several
 * currencies joined). When there is none, the token is removed and spacing is
 * tidied rather than printing a raw placeholder.
 */
export function applyAdSpend(text: string, replacement: string | null | undefined): string {
  if (!text.includes(AD_SPEND_TOKEN)) return text;
  if (replacement) return text.split(AD_SPEND_TOKEN).join(replacement);
  return text.split(AD_SPEND_TOKEN).join("").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}
