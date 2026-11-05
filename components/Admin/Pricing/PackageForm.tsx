"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { savePackage } from "@/app/(admin)/actions/pricing";
import { CURRENCY_CATALOG, CURRENCY_CODES, formatMoney } from "@/lib/pricing/currencies";
import { STAGE_LABELS } from "@/lib/pricing/public";
import { applyAdSpend, findInvalidPlaceholders } from "@/lib/pricing/text";
import { validatePackageInput, type PackageInput } from "@/lib/pricing/validate";
import { withToast } from "@/lib/admin/toast";
import { Card, Field, SaveButton, Toggle, btnGhost, inputCls, numStr, toNum } from "./ui";

export type PackageInitial = {
  id: string; slug: string; number: string; name: string; tagline: string; description: string;
  isMostPopular: boolean; isActive: boolean; stages: boolean[];
  notIncluded: string; moveUpTitle: string; moveUpText: string; ctaLabel: string; ctaLink: string;
  prices: { currency: string; monthly: number; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[];
  features: { label: string; text: string }[];
};

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function PackageForm({ initial }: { initial?: PackageInitial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [f, setF] = useState({
    slug: initial?.slug ?? "", number: initial?.number ?? "", name: initial?.name ?? "", tagline: initial?.tagline ?? "", description: initial?.description ?? "",
    isMostPopular: initial?.isMostPopular ?? false, isActive: initial?.isActive ?? true,
    notIncluded: initial?.notIncluded ?? "", moveUpTitle: initial?.moveUpTitle ?? "", moveUpText: initial?.moveUpText ?? "",
    ctaLabel: initial?.ctaLabel ?? "", ctaLink: initial?.ctaLink ?? "",
  });
  const [stages, setStages] = useState<boolean[]>(initial?.stages ?? [false, false, false, false, false]);
  const [prices, setPrices] = useState(
    Object.fromEntries(CURRENCY_CODES.map((c) => {
      const p = initial?.prices.find((x) => x.currency === c);
      return [c, { monthly: numStr(p?.monthly), setup: numStr(p?.setupFee), cap: numStr(p?.adSpendCap), active: p?.isActive ?? true }];
    })),
  );
  const [features, setFeatures] = useState(initial?.features ?? []);
  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const buildInput = (): PackageInput => ({
    ...f,
    stages: stages as PackageInput["stages"],
    prices: CURRENCY_CODES.map((c) => ({ currency: c, monthly: toNum(prices[c].monthly), setupFee: toNum(prices[c].setup), adSpendCap: toNum(prices[c].cap), isActive: prices[c].active })),
    features,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = buildInput();
    // A typed-but-invalid amount parses to null; catch it before it silently clears a price.
    const bad = CURRENCY_CODES.flatMap((c) => (["monthly", "setup", "cap"] as const).filter((k) => prices[c][k].trim() && toNum(prices[c][k]) === null).map((k) => `${c} ${k} is not a number.`));
    const errs = [...bad, ...validatePackageInput(input)];
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      const res = await withToast(savePackage(initial?.id ?? null, input), { success: "Package saved", error: "Couldn't save package" });
      if (res.success) { router.push("/admin/pricing"); router.refresh(); }
    } finally {
      setSaving(false);
    }
  };

  const moveFeature = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= features.length) return;
    const n = [...features];
    [n[i], n[j]] = [n[j], n[i]];
    setFeatures(n);
  };

  // Live preview of the {adSpend} replacement for this package.
  const capPreview = CURRENCY_CODES.filter((c) => toNum(prices[c].cap) !== null && toNum(prices[c].monthly) !== null).map((c) => formatMoney(toNum(prices[c].cap) as number, c)).join(" / ");
  const placeholderIssues = [f.moveUpText, ...features.map((x) => x.text)].flatMap((t) => findInvalidPlaceholders(t));

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/pricing" className="p-2 bg-card rounded-lg hover:bg-tint border border-border" aria-label="Back to packages"><ArrowLeft size={18} /></Link>
        <h2 className="text-xl font-bold text-foreground">{initial ? `Edit ${initial.name}` : "New package"}</h2>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
          <ul className="list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <Card title="General">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} required /></Field>
          <Field label="Slug" hint="Stable key. Used by imports and the page URL hash."><input className={inputCls} value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} required /></Field>
          <Field label="Display number" hint='e.g. "01"'><input className={inputCls} value={f.number} onChange={(e) => set("number", e.target.value)} /></Field>
          <Field label="Tagline" className="md:col-span-1"><input className={inputCls} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
          <Field label="Short description" className="md:col-span-2"><textarea rows={2} className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-6 mt-4">
          <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Active (shown on the page)" />
          <Toggle checked={f.isMostPopular} onChange={(v) => set("isMostPopular", v)} label="Most popular badge" />
        </div>
      </Card>

      <Card title="Funnel stages covered">
        <div className="flex flex-wrap gap-6">
          {STAGE_LABELS.map((l, i) => (
            <Toggle key={l} checked={stages[i]} onChange={(v) => setStages((s) => s.map((x, j) => (j === i ? v : x)))} label={l} />
          ))}
        </div>
      </Card>

      <Card title="Prices" hint="One row per currency. Leave Monthly empty for no price in that currency (that currency is then not shown for this package). Plain numbers only.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-caption">
                <th className="py-2 pr-3 font-medium">Currency</th><th className="py-2 pr-3 font-medium">Monthly</th><th className="py-2 pr-3 font-medium">One-time setup</th>
                <th className="py-2 pr-3 font-medium">Ad-spend cap</th><th className="py-2 pr-3 font-medium">Active</th><th className="py-2 font-medium">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CURRENCY_CODES.map((c) => {
                const p = prices[c];
                const upd = (patch: Partial<typeof p>) => setPrices((s) => ({ ...s, [c]: { ...s[c], ...patch } }));
                const m = toNum(p.monthly), su = toNum(p.setup), cap = toNum(p.cap);
                return (
                  <tr key={c}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground whitespace-nowrap">{CURRENCY_CATALOG[c].symbol} {c}</th>
                    <td className="py-2 pr-3"><input aria-label={`${c} monthly`} inputMode="decimal" className={inputCls} value={p.monthly} onChange={(e) => upd({ monthly: e.target.value })} /></td>
                    <td className="py-2 pr-3"><input aria-label={`${c} setup`} inputMode="decimal" className={inputCls} value={p.setup} onChange={(e) => upd({ setup: e.target.value })} /></td>
                    <td className="py-2 pr-3"><input aria-label={`${c} ad-spend cap`} inputMode="decimal" className={inputCls} value={p.cap} onChange={(e) => upd({ cap: e.target.value })} /></td>
                    <td className="py-2 pr-3"><Toggle checked={p.active} onChange={(v) => upd({ active: v })} label="" /></td>
                    <td className="py-2 text-xs text-muted">
                      {m === null ? <span className="text-caption">No price</span> : (
                        <>
                          <strong className="text-foreground">{formatMoney(m, c)}</strong>/mo
                          {su !== null && <> · +{formatMoney(su, c)} setup</>}
                          {cap !== null && <> · ads up to {formatMoney(cap, c)}</>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="What's included"
        hint="Rows shown in the package panel. Use {adSpend} to insert this package's ad-spend cap in each currency."
        action={<button type="button" className={btnGhost} onClick={() => setFeatures((s) => [...s, { label: "", text: "" }])}><Plus size={14} /> Add row</button>}
      >
        {features.length === 0 && <p className="text-sm text-caption">No rows yet.</p>}
        <div className="space-y-3">
          {features.map((ft, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-start">
              <input aria-label={`Row ${i + 1} label`} placeholder="Label (e.g. Website)" className={`${inputCls} sm:w-48`} value={ft.label} onChange={(e) => setFeatures((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <input aria-label={`Row ${i + 1} text`} placeholder="Text" className={`${inputCls} flex-1 min-w-[200px]`} value={ft.text} onChange={(e) => setFeatures((s) => s.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <div className="flex gap-1">
                <button type="button" aria-label="Move up" className={btnGhost} disabled={i === 0} onClick={() => moveFeature(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" aria-label="Move down" className={btnGhost} disabled={i === features.length - 1} onClick={() => moveFeature(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" aria-label="Remove row" className={`${btnGhost} text-red-500`} onClick={() => setFeatures((s) => s.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        {placeholderIssues.length > 0 && <p className="text-sm text-red-600 mt-3">Invalid placeholder: {placeholderIssues.join(", ")} - only {"{adSpend}"} is allowed.</p>}
        {capPreview && <p className="text-xs text-caption mt-3">{"{adSpend}"} will render as: <span className="text-foreground">{applyAdSpend("{adSpend}", capPreview)}</span></p>}
      </Card>

      <Card title="Boxes and button">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Not included" hint="Leave empty to hide the box."><textarea rows={3} className={inputCls} value={f.notIncluded} onChange={(e) => set("notIncluded", e.target.value)} /></Field>
          <div className="space-y-4">
            <Field label="Move-up box title"><input className={inputCls} value={f.moveUpTitle} onChange={(e) => set("moveUpTitle", e.target.value)} /></Field>
            <Field label="Move-up box text" hint="Leave empty to hide the box. {adSpend} is supported."><textarea rows={2} className={inputCls} value={f.moveUpText} onChange={(e) => set("moveUpText", e.target.value)} /></Field>
          </div>
          <Field label="Button label" hint='Empty = "Get started with {name}"'><input className={inputCls} value={f.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} /></Field>
          <Field label="Button link" hint="Starts with / or https://. Empty = /contact"><input className={inputCls} value={f.ctaLink} onChange={(e) => set("ctaLink", e.target.value)} /></Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <SaveButton saving={saving} label={initial ? "Save package" : "Create package"} />
        <Link href="/admin/pricing" className={btnGhost}>Cancel</Link>
      </div>
    </form>
  );
}
