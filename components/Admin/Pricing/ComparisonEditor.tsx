"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveComparisonRows } from "@/app/(admin)/actions/pricing";
import { confirmDialog } from "@/lib/admin/dialog";
import { withToast } from "@/lib/admin/toast";
import { Card, SaveButton, btnGhost, inputCls } from "./ui";

type Row = { id: string | null; label: string; cells: Record<string, string> };

export default function ComparisonEditor({ packages, rows: initial }: { packages: { id: string; name: string }[]; rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saving, setSaving] = useState(false);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const n = [...rows];
    [n[i], n[j]] = [n[j], n[i]];
    setRows(n);
  };

  const remove = async (i: number) => {
    if (rows[i].label.trim() || Object.values(rows[i].cells).some(Boolean)) {
      if (!(await confirmDialog({ title: `Remove "${rows[i].label || "this row"}"?`, text: "The row is deleted when you save.", confirmText: "Remove", danger: true })) ) return;
    }
    setRows((s) => s.filter((_, j) => j !== i));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await withToast(saveComparisonRows(rows), { success: "Comparison rows saved", error: "Couldn't save comparison rows" });
      if (res.success) router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <Card
      title="Comparison rows"
      hint="Extra rows of the comparison table. Monthly, One-time setup and Ad spend managed rows are generated automatically from the prices."
      action={<button type="button" className={btnGhost} onClick={() => setRows((s) => [...s, { id: null, label: "", cells: {} }])}><Plus size={14} /> Add row</button>}
    >
      {packages.length === 0 && <p className="text-sm text-caption">Add a package first.</p>}
      {rows.length === 0 && packages.length > 0 && <p className="text-sm text-caption">No rows yet.</p>}
      <div className="space-y-4">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <input aria-label="Row label" placeholder="Row label (e.g. Funnel stages)" className={`${inputCls} flex-1 min-w-[200px]`} value={r.label} onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <button type="button" aria-label="Move up" className={btnGhost} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
              <button type="button" aria-label="Move down" className={btnGhost} disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
              <button type="button" aria-label="Remove row" className={`${btnGhost} text-red-500`} onClick={() => remove(i)}><Trash2 size={14} /></button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))` }}>
              {packages.map((p) => (
                <label key={p.id} className="block">
                  <span className="block text-xs text-caption mb-1">{p.name}</span>
                  <input className={inputCls} value={r.cells[p.id] ?? ""} onChange={(e) => setRows((s) => s.map((x, j) => (j === i ? { ...x, cells: { ...x.cells, [p.id]: e.target.value } } : x)))} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5"><SaveButton saving={saving} onClick={save} /></div>
    </Card>
  );
}
