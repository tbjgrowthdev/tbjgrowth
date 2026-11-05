"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { savePolicies } from "@/app/(admin)/actions/pricing";
import { CURRENCY_CODES } from "@/lib/pricing/currencies";
import { confirmDialog } from "@/lib/admin/dialog";
import { withToast } from "@/lib/admin/toast";
import { Card, Field, SaveButton, btnGhost, inputCls } from "./ui";

type Policy = { id: string | null; key: string; title: string; text: string; overrides: Record<string, string> };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function PoliciesEditor({ policies: initial }: { policies: Policy[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Policy[]>(initial);
  const [saving, setSaving] = useState(false);

  const upd = (i: number, patch: Partial<Policy>) => setItems((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    setItems(n);
  };
  const remove = async (i: number) => {
    if (!(await confirmDialog({ title: `Remove "${items[i].title || items[i].key || "this policy"}"?`, text: "It is deleted, with its currency wording, when you save.", confirmText: "Remove", danger: true }))) return;
    setItems((s) => s.filter((_, j) => j !== i));
  };
  const save = async () => {
    setSaving(true);
    try {
      const res = await withToast(savePolicies(items), { success: "Policies saved", error: "Couldn't save policies" });
      if (res.success) router.refresh();
    } finally { setSaving(false); }
  };

  return (
    <Card
      title="Policies"
      hint="Info cards under the comparison table. The default text is used everywhere; a currency override replaces it for that currency. If visible currencies end up with different wording, each is listed with its region code."
      action={<button type="button" className={btnGhost} onClick={() => setItems((s) => [...s, { id: null, key: "", title: "", text: "", overrides: {} }])}><Plus size={14} /> Add policy</button>}
    >
      {items.length === 0 && <p className="text-sm text-caption">No policies yet.</p>}
      <div className="space-y-5">
        {items.map((p, i) => (
          <div key={p.id ?? `n${i}`} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input aria-label="Title" placeholder="Title (e.g. Ad spend)" className={`${inputCls} flex-1 min-w-[180px]`} value={p.title} onChange={(e) => upd(i, { title: e.target.value, key: p.id || p.key ? p.key : slugify(e.target.value) })} />
              <input aria-label="Key" placeholder="key" className={`${inputCls} sm:w-44`} value={p.key} onChange={(e) => upd(i, { key: e.target.value })} />
              <button type="button" aria-label="Move up" className={btnGhost} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
              <button type="button" aria-label="Move down" className={btnGhost} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
              <button type="button" aria-label="Remove policy" className={`${btnGhost} text-red-500`} onClick={() => remove(i)}><Trash2 size={14} /></button>
            </div>
            <Field label="Default text"><textarea rows={2} className={inputCls} value={p.text} onChange={(e) => upd(i, { text: e.target.value })} /></Field>
            <div className="grid gap-3 md:grid-cols-3">
              {CURRENCY_CODES.map((c) => (
                <Field key={c} label={`${c} override`} hint="Empty = use default">
                  <textarea rows={2} className={inputCls} value={p.overrides[c] ?? ""} onChange={(e) => upd(i, { overrides: { ...p.overrides, [c]: e.target.value } })} />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5"><SaveButton saving={saving} onClick={save} /></div>
    </Card>
  );
}
