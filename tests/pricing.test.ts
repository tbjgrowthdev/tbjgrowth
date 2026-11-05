// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatMoney, formatNumber } from "../lib/pricing/currencies";
import { applyAdSpend, findInvalidPlaceholders } from "../lib/pricing/text";
import { resolveCurrencySettings, visibleCurrencies } from "../lib/pricing/visibility";
import { resolveFootnotes, resolvePolicyEntries } from "../lib/pricing/resolve";
import { buildPublicPricing, type RawPackage, type RawPricing } from "../lib/pricing/public";
import { parseBool, parseMoney, parseWorkbook } from "../lib/pricing/import/parse";
import { EMPTY_SNAPSHOT, planImport, type Snapshot } from "../lib/pricing/import/plan";
import { safeCell, snapshotToSheets } from "../lib/pricing/import/export";
import { validatePackageInput, pricingWarnings } from "../lib/pricing/validate";

// ---------------------------------------------------------------- formatting
test("BDT uses Indian digit grouping", () => {
  assert.equal(formatMoney(150000, "BDT"), "৳1,50,000");
  assert.equal(formatMoney(50000, "BDT"), "৳50,000");
  assert.equal(formatMoney(12345678, "BDT"), "৳1,23,45,678");
  assert.equal(formatMoney(999, "BDT"), "৳999");
});

test("GBP and USD use standard grouping with the right symbol", () => {
  assert.equal(formatMoney(150000, "GBP"), "£150,000");
  assert.equal(formatMoney(995, "GBP"), "£995");
  assert.equal(formatMoney(1234567, "USD"), "$1,234,567");
});

test("decimals only appear when present and are capped at 2", () => {
  assert.equal(formatNumber(995.5, "GBP"), "995.50");
  assert.equal(formatNumber(995.456, "USD"), "995.46");
  assert.equal(formatNumber(1000, "USD"), "1,000");
  assert.equal(formatNumber(0, "BDT"), "0");
});

// ---------------------------------------------------------------- placeholder
test("{adSpend} is replaced everywhere it appears", () => {
  assert.equal(applyAdSpend("Ads up to {adSpend}. Then {adSpend}.", "£1,000"), "Ads up to £1,000. Then £1,000.");
  assert.equal(applyAdSpend("No token here", "£1"), "No token here");
});

test("{adSpend} with no cap is removed cleanly rather than printed raw", () => {
  assert.equal(applyAdSpend("Managed ads up to {adSpend} a month.", null), "Managed ads up to a month.");
  assert.ok(!applyAdSpend("x {adSpend}", "").includes("{"));
});

test("only {adSpend} is a valid placeholder", () => {
  assert.deepEqual(findInvalidPlaceholders("ok {adSpend}"), []);
  assert.deepEqual(findInvalidPlaceholders("typo {adspend}"), ["{adspend}"]);
  assert.deepEqual(findInvalidPlaceholders("broken {adSpend"), ["unbalanced { }"]);
});

// ---------------------------------------------------------------- visibility
const pkg = (over: Partial<RawPackage> & { slug: string }): RawPackage => ({
  id: over.slug, number: "", name: over.slug, tagline: "", description: "", isMostPopular: false, isActive: true, sortOrder: 0,
  stageBuild: false, stageAttract: false, stageConvert: false, stageAutomate: false, stageScale: false,
  notIncluded: "", moveUpTitle: "", moveUpText: "", ctaLabel: "", ctaLink: "", prices: [], features: [], ...over,
});
const price = (currency: string, monthly: number, extra: Partial<RawPackage["prices"][number]> = {}) => ({ currency, monthly, setupFee: null, adSpendCap: null, isActive: true, ...extra });

test("a currency is visible only if enabled AND an active package has an active price in it", () => {
  const settings = resolveCurrencySettings([{ code: "BDT", isEnabled: false }]);
  const pkgs = [
    pkg({ slug: "a", prices: [price("GBP", 1), price("BDT", 1)] }),
    pkg({ slug: "b", isActive: false, prices: [price("USD", 1)] }),
    pkg({ slug: "c", prices: [price("USD", 1, { isActive: false })] }),
  ];
  assert.deepEqual(visibleCurrencies(settings, pkgs).map((c) => c.code), ["GBP"]);
});

test("enabling USD makes it appear once a price exists; no USD price means nothing about USD", () => {
  const noUsd = buildPublicPricing({ currencies: [], packages: [pkg({ slug: "a", prices: [price("GBP", 995)] })], comparisonRows: [], policies: [], settings: {} });
  assert.deepEqual(noUsd.currencies.map((c) => c.code), ["GBP"]);
  assert.ok(!JSON.stringify(noUsd).includes("USD"));
  const withUsd = buildPublicPricing({ currencies: [{ code: "USD", isEnabled: true }], packages: [pkg({ slug: "a", prices: [price("GBP", 995), price("USD", 1250)] })], comparisonRows: [], policies: [], settings: {} });
  assert.deepEqual(withUsd.currencies.map((c) => c.code).sort(), ["GBP", "USD"]);
  assert.equal(withUsd.packages[0].prices.find((p) => p.code === "USD")?.monthly, "$1,250");
});

test("a package without a price in a currency does not show that currency", () => {
  const out = buildPublicPricing({
    currencies: [],
    packages: [pkg({ slug: "a", sortOrder: 0, prices: [price("GBP", 1), price("USD", 2)] }), pkg({ slug: "b", sortOrder: 1, prices: [price("GBP", 3)] })],
    comparisonRows: [], policies: [], settings: {},
  });
  assert.deepEqual(out.packages[1].prices.map((p) => p.code), ["GBP"]);
});

test("empty database yields an empty, non-throwing public model", () => {
  const out = buildPublicPricing({ currencies: [], packages: [], comparisonRows: [], policies: [], settings: {} });
  assert.equal(out.hasContent, false);
  assert.deepEqual(out.currencies, []);
  assert.deepEqual(out.footnotes, []);
});

test("{adSpend} in features and move-up text lists each currency's cap", () => {
  const out = buildPublicPricing({
    currencies: [],
    packages: [pkg({ slug: "a", moveUpText: "Raise ads above {adSpend}.", prices: [price("GBP", 1, { adSpendCap: 1000 }), price("BDT", 1, { adSpendCap: 150000 })], features: [{ label: "Paid ads", text: "Up to {adSpend}", sortOrder: 1 }] })],
    comparisonRows: [], policies: [], settings: {},
  });
  assert.equal(out.packages[0].features[0].text, "Up to ৳1,50,000 / £1,000");
  assert.equal(out.packages[0].moveUpText, "Raise ads above ৳1,50,000 / £1,000.");
});

// ---------------------------------------------------------------- fallbacks
test("policy: identical wording across visible currencies is shown once", () => {
  const p = { key: "k", title: "T", text: "Default", overrides: {} };
  assert.deepEqual(resolvePolicyEntries(p, ["GBP", "BDT"]), [{ code: null, text: "Default" }]);
});

test("policy: differing per-currency wording lists each with its region code", () => {
  const p = { key: "k", title: "T", text: "Default", overrides: { GBP: "Card", BDT: "bKash" } };
  assert.deepEqual(resolvePolicyEntries(p, ["GBP", "BDT", "USD"]), [
    { code: "UK", text: "Card" }, { code: "BD", text: "bKash" }, { code: "US", text: "Default" },
  ]);
});

test("policy: an override for a hidden currency is ignored", () => {
  const p = { key: "k", title: "T", text: "Default", overrides: { USD: "Dollar" } };
  assert.deepEqual(resolvePolicyEntries(p, ["GBP"]), [{ code: null, text: "Default" }]);
});

test("footnotes: per-currency with default fallback, de-duplicated", () => {
  assert.deepEqual(resolveFootnotes({ "": "Base", GBP: "UK note" }, ["GBP", "BDT", "USD"]), ["UK note", "Base"]);
  assert.deepEqual(resolveFootnotes({ "": "Base" }, ["GBP", "BDT"]), ["Base"]);
  assert.deepEqual(resolveFootnotes({}, ["GBP"]), []);
});

// ---------------------------------------------------------------- import: parsing
test("price parsing tolerates separators and rejects symbols or text", () => {
  assert.equal(parseMoney("50,000"), 50000);
  assert.equal(parseMoney("1,50,000"), 150000);
  assert.equal(parseMoney("995.50"), 995.5);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("£995"), "invalid");
  assert.equal(parseMoney("৳50,000"), "invalid");
  assert.equal(parseMoney("1,5"), "invalid");
  assert.equal(parseMoney("abc"), "invalid");
  assert.equal(parseMoney("-5"), "negative");
});

test("TRUE/FALSE accepts true/false/yes/no/1/0", () => {
  for (const t of ["TRUE", "yes", "1", "True"]) assert.equal(parseBool(t), true);
  for (const f of ["FALSE", "no", "0"]) assert.equal(parseBool(f), false);
  assert.equal(parseBool("maybe"), null);
});

const wb = {
  Packages: [["slug", "name", "most_popular"], ["basic", "Basic", "FALSE"], ["growth", "Growth", "yes"]],
  Prices: [["package_slug", "currency", "monthly", "setup", "ad_cap", "active"], ["basic", "GBP", "495", "", "", "TRUE"], ["growth", "bdt", "1,50,000", "50,000", "", ""]],
};

test("valid workbook parses; header and currency matching are case-insensitive; Instructions/Examples ignored", () => {
  const p = parseWorkbook({ ...wb, Instructions: [["junk"]], Examples: [["slug"], ["example"]] });
  assert.equal(p.issues.filter((i) => i.level === "error").length, 0);
  assert.equal(p.packages.length, 2);
  assert.equal(p.prices[1].currency, "BDT");
  assert.equal(p.prices[1].monthly, 150000);
  assert.equal(p.packages[1].fields.isMostPopular, true);
});

test("validation reports missing columns, bad values, duplicates and unknown currency", () => {
  const p = parseWorkbook({
    Packages: [["slug", "name", "active"], ["a", "A", "maybe"], ["a", "A2", ""], ["Bad Slug", "X", ""]],
    Prices: [["package_slug", "currency", "monthly"], ["a", "EUR", "5"], ["a", "GBP", "£5"], ["a", "GBP", "-3"]],
    Features: [["label"], ["x"]],
  });
  const msgs = p.issues.filter((i) => i.level === "error").map((i) => i.sheet + ": " + i.message).join("\n");
  assert.match(msgs, /Packages: "active" must be TRUE\/FALSE/);
  assert.match(msgs, /Duplicate key "a"/);
  assert.match(msgs, /Invalid slug/);
  assert.match(msgs, /Unknown currency "EUR"/);
  assert.match(msgs, /plain number/);
  assert.match(msgs, /Features: Missing required column "package_slug"/);
});

test("extra columns warn instead of failing; empty rows are ignored", () => {
  const p = parseWorkbook({ Packages: [["slug", "name", "bogus"], ["a", "A", "x"], ["", "", ""], []] });
  assert.equal(p.packages.length, 1);
  assert.ok(p.issues.some((i) => i.level === "warning" && /bogus/.test(i.message)));
  assert.equal(p.issues.filter((i) => i.level === "error").length, 0);
});

test("a price row with no numbers is skipped (no price in that currency), not an error", () => {
  const p = parseWorkbook({ Packages: [["slug", "name"], ["a", "A"]], Prices: [["package_slug", "currency", "monthly", "setup", "ad_cap"], ["a", "USD", "", "", ""]] });
  assert.equal(p.prices.length, 0);
  assert.equal(p.issues.filter((i) => i.level === "error").length, 0);
});

test("only footnote may be set per currency", () => {
  const p = parseWorkbook({ Settings: [["key", "currency", "value"], ["headline", "GBP", "x"], ["footnote", "GBP", "y"], ["nope", "", "z"]] });
  assert.equal(p.settings.length, 1);
  assert.equal(p.issues.filter((i) => i.level === "error").length, 2);
});

// ---------------------------------------------------------------- import: plan / upsert
const snap = (): Snapshot => ({
  ...EMPTY_SNAPSHOT,
  packages: [{ slug: "basic", name: "Basic", number: "01", tagline: "T", description: "", isMostPopular: false, isActive: true, sortOrder: 0, stageBuild: true, stageAttract: false, stageConvert: false, stageAutomate: false, stageScale: false, notIncluded: "", moveUpTitle: "", moveUpText: "", ctaLabel: "", ctaLink: "" }],
  prices: [{ slug: "basic", currency: "GBP", monthly: 495, setupFee: null, adSpendCap: null, isActive: true }],
});

test("dry run into an empty database counts everything as create", () => {
  const plan = planImport(parseWorkbook(wb), EMPTY_SNAPSHOT);
  assert.equal(plan.errorCount, 0);
  assert.equal(plan.counts.packages.create, 2);
  assert.equal(plan.counts.prices.create, 2);
  assert.equal(plan.upserts.packages.length, 2);
});

test("upsert: existing records update or stay unchanged; nothing is deleted", () => {
  const plan = planImport(parseWorkbook({
    Packages: [["slug", "name"], ["basic", "Basic"], ["growth", "Growth"]],
    Prices: [["package_slug", "currency", "monthly"], ["basic", "GBP", "495"], ["basic", "USD", "600"]],
  }), snap());
  assert.equal(plan.counts.packages.unchanged, 1);   // basic: same name, other fields untouched (columns absent)
  assert.equal(plan.counts.packages.create, 1);
  assert.equal(plan.counts.prices.unchanged, 1);
  assert.equal(plan.counts.prices.create, 1);
  assert.equal(Object.values(plan.counts).reduce((n, c) => n + c.delete, 0), 0);
  const changed = planImport(parseWorkbook({ Packages: [["slug", "name", "tagline"], ["basic", "Basic", "New"]] }), snap());
  assert.equal(changed.counts.packages.update, 1);
  assert.equal(changed.upserts.packages[0].stageBuild, true); // preserved from existing
});

test("references to unknown packages are errors; packages defined in the same file are fine", () => {
  const bad = planImport(parseWorkbook({ Prices: [["package_slug", "currency", "monthly"], ["ghost", "GBP", "5"]] }), snap());
  assert.equal(bad.errorCount, 1);
  const ok = planImport(parseWorkbook({ Packages: [["slug", "name"], ["ghost", "Ghost"]], Prices: [["package_slug", "currency", "monthly"], ["ghost", "GBP", "5"]] }), snap());
  assert.equal(ok.errorCount, 0);
});

test("replace mode plans deletes of all existing records and recreates from the file", () => {
  const plan = planImport(parseWorkbook(wb), snap(), "replace");
  assert.equal(plan.counts.packages.delete, 1);
  assert.equal(plan.counts.packages.create, 2);
  assert.equal(plan.counts.packages.unchanged, 0);
});

test("USD rows added later are just creates; no code change needed", () => {
  const plan = planImport(parseWorkbook({ Prices: [["package_slug", "currency", "monthly"], ["basic", "USD", "650"]] }), snap());
  assert.equal(plan.counts.prices.create, 1);
  assert.equal(plan.upserts.prices[0].currency, "USD");
});

test("policy overrides need a default line unless the policy exists; new policy needs a title", () => {
  const a = planImport(parseWorkbook({ Policies: [["policy_key", "currency", "text"], ["ad", "USD", "x"]] }), snap());
  assert.equal(a.errorCount, 1);
  const b = planImport(parseWorkbook({ Policies: [["policy_key", "title", "currency", "text"], ["ad", "", "", "x"]] }), snap());
  assert.equal(b.errorCount, 1);
  const c = planImport(parseWorkbook({ Policies: [["policy_key", "title", "currency", "text"], ["ad", "Ad spend", "", "x"], ["ad", "", "USD", "y"]] }), snap());
  assert.equal(c.errorCount, 0);
  assert.equal(c.counts.policies.create, 1);
  assert.equal(c.counts.policyTexts.create, 1);
});

test("invalid {adSpend} placeholders in features are import errors", () => {
  const p = planImport(parseWorkbook({ Features: [["package_slug", "label", "text"], ["basic", "Ads", "up to {adspend}"]] }), snap());
  assert.equal(p.errorCount, 1);
});

// ---------------------------------------------------------------- export
test("export guards against spreadsheet formula injection", () => {
  assert.equal(safeCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(safeCell("+1"), "'+1");
  assert.equal(safeCell("-1"), "'-1");
  assert.equal(safeCell("@x"), "'@x");
  assert.equal(safeCell("plain"), "plain");
  assert.equal(safeCell(5), 5);
});

test("export then re-import round-trips as 'unchanged' (including guarded text)", () => {
  const s = snap();
  s.packages[0].tagline = "=cmd";
  s.features = [{ slug: "basic", label: "Website", text: "Up to {adSpend}", sortOrder: 1 }];
  s.settings = [{ key: "footnote", currency: "GBP", value: "+note" }];
  s.policies = [{ key: "ad", title: "Ad spend", sortOrder: 1, text: "d" }];
  s.policyTexts = [{ key: "ad", currency: "USD", text: "u" }];
  s.rows = [{ label: "Funnel stages", sortOrder: 1 }];
  s.cells = [{ label: "Funnel stages", slug: "basic", text: "3" }];
  const sheets = snapshotToSheets(s);
  const raw = Object.fromEntries(Object.entries(sheets).map(([k, m]) => [k, m.map((r) => r.map((c) => String(c)))]));
  const plan = planImport(parseWorkbook(raw), s);
  assert.equal(plan.errorCount, 0, JSON.stringify(plan.issues));
  for (const [name, c] of Object.entries(plan.counts)) {
    assert.equal(c.create + c.update, 0, `${name} should be unchanged: ${JSON.stringify(c)}`);
  }
});

// ---------------------------------------------------------------- admin validation
test("package validation: non-negative numbers, slug, placeholder", () => {
  const base = { slug: "ok", number: "", name: "N", tagline: "", description: "", isMostPopular: false, isActive: true, stages: [false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean], notIncluded: "", moveUpTitle: "", moveUpText: "", ctaLabel: "", ctaLink: "", prices: [], features: [] };
  assert.deepEqual(validatePackageInput(base), []);
  assert.ok(validatePackageInput({ ...base, prices: [{ currency: "GBP", monthly: -1, setupFee: null, adSpendCap: null, isActive: true }] }).length > 0);
  assert.ok(validatePackageInput({ ...base, slug: "Bad Slug" }).length > 0);
  assert.ok(validatePackageInput({ ...base, moveUpText: "{nope}" }).length > 0);
  assert.ok(validatePackageInput({ ...base, ctaLink: "javascript:alert(1)" }).length > 0);
});

test("warnings: enabled currency without prices, active package without price", () => {
  const raw: RawPricing = { currencies: [], packages: [pkg({ slug: "a" })], comparisonRows: [], policies: [], settings: {} };
  const w = pricingWarnings(raw).map((x) => x.message).join("\n");
  assert.match(w, /USD is enabled but no active package/);
  assert.match(w, /has no active price in any currency/);
});
