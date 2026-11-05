"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePriceMatrix } from "@/app/(admin)/actions/pricing";
import { CURRENCY_CATALOG, CURRENCY_CODES, formatMoney } from "@/lib/pricing/currencies";
import { withToast } from "@/lib/admin/toast";
import { Card, SaveButton, Toggle, inputCls, numStr, toNum } from "./ui";

type Pkg = { id: string; name: string; prices: { currency: string; monthly: number; setupFee: number | null; adSpendCap: number | null; isActive: boolean }[] };
type Cell = { monthly: string; setup: string; cap: string; active: boolean };

export default function PriceMatrix({ packages }: { packages: Pkg[] }) {
  const router = useRouter();
  const init = () => {
    const m: Record<string, Cell> = {};
    for (const p of packages) for (const c of CURRENCY_CODES) {
      const x = p.prices.find((y) => y.currency === c);
      m[`${p.id}|${c}`] = { monthly: numStr(x?.monthly), setup: numStr(x?.setupFee), cap: numStr(x?.adSpendCap), active: x?.isActive ?? true };
    }
    return m;
  };
  const [initial] = useState(init);
  const [cells, setCells] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (key: string, patch: Partial<Cell>) => setCells((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const save = async () => {
    const out: Parameters<typeof savePriceMatrix>[0] = [];
    for (const key of Object.keys(cells)) {
      const a = cells[key], b = initial[key];
      if (a.monthly === b.monthly && a.setup === b.setup && a.cap === b.cap && a.active === b.active) continue;
      for (const v of [a.monthly, a.setup, a.cap]) {
        if (v.trim() && toNum(v) === null) { setError(`"${v}" is not a number.`); return; }
        if ((toNum(v) ?? 0) < 0) { setError("Amounts cannot be negative."); return; }
      }
      const [packageId, currency] = key.split("|");
      out.push({ packageId, currency, monthly: toNum(a.monthly), setupFee: toNum(a.setup), adSpendCap: toNum(a.cap), isActive: a.active });
    }
    if (out.length === 0) { setError("Nothing changed."); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await withToast(savePriceMatrix(out), { success: "Prices saved", error: "Couldn't save prices" });
      if (res.success) router.refresh();
    } finally { setSaving(false); }
  };

  if (packages.length === 0) return <Card><p className="text-sm text-caption">Add a package first.</p></Card>;

  return (
    <Card title="Price matrix" hint="Packages × currencies. Leave Monthly empty for no price in that currency. USD is available here from day one - add USD prices and enable it under Currencies.">
      {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr>
              <th className="text-left p-2 text-caption font-medium">Package</th>
              {CURRENCY_CODES.map((c) => <th key={c} className="text-left p-2 text-caption font-medium">{CURRENCY_CATALOG[c].symbol} {c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {packages.map((p) => (
              <tr key={p.id} className="align-top">
                <th scope="row" className="text-left p-2 font-medium text-foreground whitespace-nowrap">{p.name}</th>
                {CURRENCY_CODES.map((c) => {
                  const k = `${p.id}|${c}`;
                  const cell = cells[k];
                  const m = toNum(cell.monthly);
                  return (
                    <td key={c} className="p-2">
                      <div className="grid gap-1.5 min-w-[170px]">
                        <input aria-label={`${p.name} ${c} monthly`} placeholder="Monthly" inputMode="decimal" className={inputCls} value={cell.monthly} onChange={(e) => upd(k, { monthly: e.target.value })} />
                        <input aria-label={`${p.name} ${c} setup`} placeholder="Setup" inputMode="decimal" className={inputCls} value={cell.setup} onChange={(e) => upd(k, { setup: e.target.value })} />
                        <input aria-label={`${p.name} ${c} ad cap`} placeholder="Ad-spend cap" inputMode="decimal" className={inputCls} value={cell.cap} onChange={(e) => upd(k, { cap: e.target.value })} />
                        <div className="flex items-center justify-between text-xs text-muted">
                          <Toggle checked={cell.active} onChange={(v) => upd(k, { active: v })} label="Active" />
                          <span>{m === null ? "—" : formatMoney(m, c)}</span>
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5"><SaveButton saving={saving} onClick={save} label="Save prices" /></div>
    </Card>
  );
}
