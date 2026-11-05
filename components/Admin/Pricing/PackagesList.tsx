"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Edit, GripVertical, Plus, Star, Trash2 } from "lucide-react";
import { deletePackage, reorderPackages, setPackageActive } from "@/app/(admin)/actions/pricing";
import { confirmDialog } from "@/lib/admin/dialog";
import { toast, withToast } from "@/lib/admin/toast";
import { btnPrimary, Toggle } from "./ui";

export type PackageRow = { id: string; slug: string; number: string; name: string; tagline: string; isActive: boolean; isMostPopular: boolean; currencies: string[] };

export default function PackagesList({ initial }: { initial: PackageRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);

  const persist = async (next: PackageRow[]) => {
    const prev = rows;
    setRows(next);
    const res = await withToast(reorderPackages(next.map((r) => r.id)), { success: "Order saved", error: "Couldn't save order" });
    if (!res.success) setRows(prev);
    else router.refresh();
  };

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    void persist(next);
  };

  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = rows.findIndex((r) => r.id === dragId);
    const to = rows.findIndex((r) => r.id === targetId);
    const next = [...rows];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setDragId(null);
    void persist(next);
  };

  const toggle = async (row: PackageRow, v: boolean) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, isActive: v } : r)));
    const res = await withToast(setPackageActive(row.id, v), { success: v ? "Package activated" : "Package hidden", error: "Couldn't update package" });
    if (!res.success) setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, isActive: !v } : r)));
    else router.refresh();
  };

  const remove = async (row: PackageRow) => {
    if (!(await confirmDialog({ title: `Delete "${row.name}"?`, text: "Its prices, features and comparison cells are deleted too. This cannot be undone.", confirmText: "Delete", danger: true }))) return;
    const res = await deletePackage(row.id);
    if (res.success) { setRows((rs) => rs.filter((r) => r.id !== row.id)); toast.success("Package deleted"); router.refresh(); }
    else toast.error("Couldn't delete package", { description: res.error });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-caption">Drag rows (or use the arrows) to reorder. Hidden packages don&apos;t appear on the public page.</p>
        <Link href="/admin/pricing/packages/new" className={btnPrimary}><Plus size={16} /> Add package</Link>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-caption">
            No packages yet. Add one, or load everything from <Link className="underline" href="/admin/pricing/import">Import / Export</Link>.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li
                key={r.id}
                draggable
                onDragStart={() => setDragId(r.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(r.id)}
                onDragEnd={() => setDragId(null)}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${dragId === r.id ? "opacity-50" : ""}`}
              >
                <GripVertical size={18} className="text-caption cursor-grab" aria-hidden="true" />
                <div className="flex flex-col">
                  <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="text-caption hover:text-foreground disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button type="button" aria-label={`Move ${r.name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="text-caption hover:text-foreground disabled:opacity-30"><ArrowDown size={14} /></button>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    {r.number && <span className="text-caption text-xs">{r.number}</span>}
                    {r.name}
                    {r.isMostPopular && <Star size={14} className="text-yellow-500 fill-yellow-500" aria-label="Most popular" />}
                  </div>
                  <div className="text-xs text-caption">{r.tagline || r.slug}</div>
                </div>
                <div className="text-xs text-muted min-w-[110px]">{r.currencies.length ? r.currencies.join(" · ") : <span className="text-amber-600">No prices</span>}</div>
                <Toggle checked={r.isActive} onChange={(v) => toggle(r, v)} label="Active" />
                <Link href={`/admin/pricing/packages/${r.id}`} aria-label={`Edit ${r.name}`} className="text-brand-orange-deep dark:text-brand-orange-light"><Edit size={18} /></Link>
                <button type="button" aria-label={`Delete ${r.name}`} onClick={() => remove(r)} className="text-red-500 hover:text-red-600"><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
