"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCurrencies } from "@/app/(admin)/actions/pricing";
import { CURRENCY_CATALOG } from "@/lib/pricing/currencies";
import { withToast } from "@/lib/admin/toast";
import { Card, SaveButton, Toggle, inputCls } from "./ui";

type Row = { code: string; label: string; isEnabled: boolean; sortOrder: number; hasPrice: boolean };

export default function CurrenciesEditor({ rows: initial }: { rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const upd = (code: string, patch: Partial<Row>) => setRows((s) => s.map((r) => (r.code === code ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      const res = await withToast(saveCurrencies(rows.map(({ code, label, isEnabled, sortOrder }) => ({ code, label, isEnabled, sortOrder }))), { success: "Currencies saved", error: "Couldn't save currencies" });
      if (res.success) router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <Card title="Currencies" hint="A currency appears on the public page only when it is enabled AND at least one active package has an active price in it.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-caption"><th className="py-2 pr-3 font-medium">Currency</th><th className="py-2 pr-3 font-medium">Enabled</th><th className="py-2 pr-3 font-medium">Label on price cards</th><th className="py-2 pr-3 font-medium w-24">Order</th><th className="py-2 font-medium">On the page</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.code}>
                <th scope="row" className="py-2 pr-3 text-left text-foreground font-medium whitespace-nowrap">{CURRENCY_CATALOG[r.code as keyof typeof CURRENCY_CATALOG].symbol} {r.code}</th>
                <td className="py-2 pr-3"><Toggle checked={r.isEnabled} onChange={(v) => upd(r.code, { isEnabled: v })} label={r.isEnabled ? "On" : "Off"} /></td>
                <td className="py-2 pr-3"><input aria-label={`${r.code} label`} className={inputCls} placeholder={CURRENCY_CATALOG[r.code as keyof typeof CURRENCY_CATALOG].defaultLabel} value={r.label} onChange={(e) => upd(r.code, { label: e.target.value })} /></td>
                <td className="py-2 pr-3"><input aria-label={`${r.code} order`} type="number" className={inputCls} value={r.sortOrder} onChange={(e) => upd(r.code, { sortOrder: Number(e.target.value) || 0 })} /></td>
                <td className="py-2 text-xs">{r.isEnabled && r.hasPrice ? <span className="text-green-600">Shown</span> : <span className="text-caption">{!r.isEnabled ? "Hidden (disabled)" : "Hidden (no active price yet)"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5"><SaveButton saving={saving} onClick={save} /></div>
    </Card>
  );
}
