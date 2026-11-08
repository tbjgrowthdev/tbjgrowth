"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { createContentBlock, updateContentBlock } from "@/app/(admin)/actions/blocks";
import { BLOCK_FIELDS, BLOCK_HELP, BLOCK_LABELS } from "@/lib/blocks/fields";
import { BLOCK_TYPES, defaultBlockData, isBlockType, type BlockType } from "@/lib/blocks/types";
import { withToast } from "@/lib/admin/toast";
import BlockFields, { type FieldValues, type PickerOptions } from "./BlockFields";

type Initial = { id: string; name: string; type: string; data: string };
type Usage = { pages: { id: string; title: string; slug: string }[]; templates: { id: string; name: string }[] };

function readData(raw: string): FieldValues {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function ReusableBlockForm({ initial, usage, options }: { initial?: Initial; usage?: Usage; options: PickerOptions }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<BlockType>(isBlockType(initial?.type) ? initial.type : "cta");
  const [data, setData] = useState<FieldValues>(initial ? readData(initial.data) : defaultBlockData("cta"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const used = (usage?.pages.length ?? 0) + (usage?.templates.length ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = initial
        ? await withToast(updateContentBlock(initial.id, { name, data }), { success: "Block updated", error: "Couldn't update block" })
        : await withToast(createContentBlock({ name, type, data }), { success: "Block created", error: "Couldn't create block" });
      if (result.success) {
        router.push("/admin/blocks");
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2"><AlertCircle size={20} />{error}</div>
      )}

      {initial && used > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Used in {used} place{used === 1 ? "" : "s"} — saving changes goes live there immediately.</p>
          <ul className="mt-2 list-disc pl-5 space-y-0.5">
            {usage?.pages.map((p) => <li key={p.id}>Page: <Link className="underline" href={`/admin/pages/${p.id}`}>{p.title}</Link></li>)}
            {usage?.templates.map((t) => <li key={t.id}>pSEO template: <Link className="underline" href={`/admin/programmatic-seo/${t.id}`}>{t.name}</Link></li>)}
          </ul>
        </div>
      )}

      <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="block-name" className="block text-sm font-medium text-muted mb-1">Name</label>
            <input id="block-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Book a call CTA" className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange" />
          </div>
          <div>
            <label htmlFor="block-type" className="block text-sm font-medium text-muted mb-1">Type</label>
            {initial ? (
              <p id="block-type" className="px-4 py-2 text-foreground">{BLOCK_LABELS[type]} <span className="text-xs text-caption">(fixed after creation)</span></p>
            ) : (
              <select
                id="block-type"
                value={type}
                onChange={(e) => { const t = e.target.value as BlockType; setType(t); setData(defaultBlockData(t)); }}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
              </select>
            )}
          </div>
        </div>
        <p className="text-xs text-caption">{BLOCK_HELP[type]}</p>
        <BlockFields fields={BLOCK_FIELDS[type]} value={data} onChange={setData} options={options} idPrefix="reusable" />
      </div>

      <div className="flex justify-end gap-4">
        <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-border rounded-lg hover:bg-background">Cancel</button>
        <button type="submit" disabled={saving} className="px-6 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
          {saving ? "Saving..." : initial ? "Update block" : "Create block"}
        </button>
      </div>
    </form>
  );
}
