// Fixed sheet/column contract for the pricing Excel/CSV import + export.
// Header names are fixed (matched case-insensitively). Used by the parser,
// the template builder, the exporter and the Instructions sheet.

export const SHEET_NAMES = ["Settings", "Currencies", "Packages", "Prices", "Features", "ComparisonRows", "Policies"] as const;
export type SheetName = (typeof SHEET_NAMES)[number];

export const IGNORED_SHEETS = ["instructions", "examples"];

export const SETTING_KEYS = ["eyebrow", "headline", "intro", "compare_title", "compare_subtitle", "upfront_offer", "contract_line", "footnote"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export type ColumnSpec = { name: string; required: boolean; description: string };
export type SheetSpec = {
  name: SheetName;
  /** What a row means + how rows are matched to existing records. */
  summary: string;
  columns: ColumnSpec[];
  /** Illustrative rows for the Examples sheet only. Never imported. */
  examples: string[][];
};

export const SHEET_SPECS: Record<SheetName, SheetSpec> = {
  Settings: {
    name: "Settings",
    summary: "Global page texts. One row per setting. Matched by key + currency.",
    columns: [
      { name: "key", required: true, description: `One of: ${SETTING_KEYS.join(", ")}.` },
      { name: "currency", required: false, description: "Blank = default text. BDT, GBP or USD = text for that currency. Only the footnote key may be set per currency." },
      { name: "value", required: true, description: "The text. Blank clears the setting." },
    ],
    examples: [
      ["headline", "", "Example headline"],
      ["footnote", "", "Example default footnote"],
      ["footnote", "GBP", "Example footnote for GBP"],
    ],
  },
  Currencies: {
    name: "Currencies",
    summary: "Enable/disable currencies and set their label and order. Matched by code.",
    columns: [
      { name: "code", required: true, description: "BDT, GBP or USD." },
      { name: "label", required: false, description: "Label on the price cards, e.g. United Kingdom · GBP. Blank = built-in label." },
      { name: "enabled", required: false, description: "TRUE/FALSE (also yes/no/1/0). Blank = TRUE." },
      { name: "sort_order", required: false, description: "Whole number; lower shows first." },
    ],
    examples: [["USD", "United States · USD", "TRUE", "3"]],
  },
  Packages: {
    name: "Packages",
    summary: "One row per package. Matched by slug. A column that is missing from the sheet leaves that field untouched on existing packages.",
    columns: [
      { name: "slug", required: true, description: "Stable key, lowercase letters/numbers/hyphens, e.g. basic." },
      { name: "number", required: false, description: 'Display number such as "01". Keep it as text.' },
      { name: "name", required: true, description: "Package name." },
      { name: "tagline", required: false, description: "Short tagline." },
      { name: "description", required: false, description: "Short description shown in the package panel." },
      { name: "most_popular", required: false, description: "TRUE/FALSE. Shows the MOST POPULAR badge." },
      { name: "active", required: false, description: "TRUE/FALSE. Blank = TRUE. Inactive packages are hidden on the page." },
      { name: "sort_order", required: false, description: "Whole number; lower shows first." },
      { name: "stage_build", required: false, description: "TRUE/FALSE. Funnel stage covered." },
      { name: "stage_attract", required: false, description: "TRUE/FALSE." },
      { name: "stage_convert", required: false, description: "TRUE/FALSE." },
      { name: "stage_automate", required: false, description: "TRUE/FALSE." },
      { name: "stage_scale", required: false, description: "TRUE/FALSE." },
      { name: "not_included", required: false, description: 'Text of the "Not included" box. Blank hides the box.' },
      { name: "move_up_title", required: false, description: 'Title of the "Move up" box.' },
      { name: "move_up_text", required: false, description: 'Text of the "Move up" box. {adSpend} is replaced by the package ad-spend cap in each currency. Blank hides the box.' },
      { name: "cta_label", required: false, description: 'Button label. Blank = "Get started with {Name}".' },
      { name: "cta_link", required: false, description: "Button link. Must start with / or https://. Blank = /contact." },
    ],
    examples: [["example-package", "01", "Example", "Example tagline.", "Example description.", "FALSE", "TRUE", "1", "TRUE", "TRUE", "FALSE", "FALSE", "FALSE", "", "", "", "", ""]],
  },
  Prices: {
    name: "Prices",
    summary: "One row per package per currency. Matched by package_slug + currency. Leave a currency out (or leave its numbers blank) to show no price in that currency.",
    columns: [
      { name: "package_slug", required: true, description: "Slug of a package (in this file or already saved)." },
      { name: "currency", required: true, description: "BDT, GBP or USD." },
      { name: "monthly", required: true, description: "Monthly price as a plain number. Thousands separators are fine; do not include currency symbols." },
      { name: "setup", required: false, description: "One-time setup fee, plain number. Blank = none." },
      { name: "ad_cap", required: false, description: "Managed ad spend included, plain number. Blank = none." },
      { name: "active", required: false, description: "TRUE/FALSE. Blank = TRUE." },
    ],
    examples: [["example-package", "USD", "1000", "500", "1500", "TRUE"]],
  },
  Features: {
    name: "Features",
    summary: 'The "What\'s included" rows. Matched by package_slug + label.',
    columns: [
      { name: "package_slug", required: true, description: "Slug of a package." },
      { name: "label", required: true, description: "Row label, e.g. Website, SEO." },
      { name: "text", required: false, description: "Row text. {adSpend} is replaced by the package ad-spend cap in each currency." },
      { name: "sort_order", required: false, description: "Whole number; lower shows first." },
    ],
    examples: [["example-package", "Paid ads", "Managed ads up to {adSpend} a month", "1"]],
  },
  ComparisonRows: {
    name: "ComparisonRows",
    summary: "Extra rows of the comparison table, long format: one line per row per package. Matched by row_label + package_slug. Monthly, setup and ad-spend rows are generated automatically from Prices.",
    columns: [
      { name: "row_label", required: true, description: "Row title, e.g. Funnel stages." },
      { name: "row_order", required: false, description: "Whole number; lower shows first. Use the same value on every line of a row." },
      { name: "package_slug", required: true, description: "Slug of a package." },
      { name: "text", required: false, description: "The cell text for that package." },
    ],
    examples: [["Example row", "1", "example-package", "Example value"]],
  },
  Policies: {
    name: "Policies",
    summary: "Info cards under the table. Matched by policy_key + currency. A line with a blank currency is the default wording; a line with a currency overrides it for that currency.",
    columns: [
      { name: "policy_key", required: true, description: "Stable key, e.g. contract." },
      { name: "title", required: false, description: "Card title. Required on the default (blank-currency) line when the policy is new." },
      { name: "sort_order", required: false, description: "Whole number; lower shows first." },
      { name: "currency", required: false, description: "Blank = default text. BDT, GBP or USD = override for that currency." },
      { name: "text", required: true, description: "The wording. On an override line, blank removes the override." },
    ],
    examples: [["example-policy", "Example title", "1", "", "Example default wording"], ["example-policy", "", "", "USD", "Example USD wording"]],
  },
};

/** Normalised header key: lowercase, trimmed, internal spaces -> underscore. */
export function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function matchSheetName(raw: string): SheetName | null {
  const n = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  return SHEET_NAMES.find((s) => s.toLowerCase() === n) ?? null;
}

export const LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRowsPerSheet: 2000,
  maxCellChars: 5000,
};
