"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Link2, Plus, Save, Trash2 } from "lucide-react";
import { createContentBlock, getBlockEditorOptions } from "@/app/(admin)/actions/blocks";
import { BLOCK_FIELDS, BLOCK_HELP, BLOCK_LABELS } from "@/lib/blocks/fields";
import { BLOCK_TYPES, defaultBlockData, isBlockType, type BlockType } from "@/lib/blocks/types";
import { withToast } from "@/lib/admin/toast";
import BlockFields, { type FieldValues, type PickerOptions } from "./BlockFields";

type ReusableOption = { id: string; name: string; type: string };

// The editor works on loosely typed blocks: it must be able to hold half-finished data (an empty heading, a button
// with no link yet). The server rejects invalid blocks on save with a message naming the block.
export type EditableBlock = { id: string; type: string; data?: FieldValues; blockId?: string };

/** Reads a stored `blocks` JSON column into the editor. The server already validated it; unreadable input starts empty. */
export function readBlocks(raw: unknown): EditableBlock[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((b) => b && typeof b === "object" && typeof b.id === "string") : [];
  } catch {
    return [];
  }
}

const newId = () => `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const btn = "px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-tint disabled:opacity-40";

/**
 * Composes a page (or pSEO template) from blocks: add, reorder, remove, edit in place, drop in a reusable block, or
 * turn a block into a reusable one. Pure controlled component — the parent form owns the list and saves it.
 */
export default function BlocksEditor({ value, onChange, disabled }: { value: EditableBlock[]; onChange: (next: EditableBlock[]) => void; disabled?: boolean }) {
  const [options, setOptions] = useState<PickerOptions>({ testimonials: [], faqs: [], packages: [] });
  const [reusable, setReusable] = useState<ReusableOption[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [addType, setAddType] = useState<BlockType>("hero");
  const [addReusable, setAddReusable] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reusableName, setReusableName] = useState("");

  useEffect(() => {
    let cancelled = false;
    getBlockEditorOptions().then((o) => {
      if (cancelled) return;
      setOptions({ testimonials: o.testimonials, faqs: o.faqs, packages: o.packages });
      setReusable(o.reusable);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (id: string, patch: Partial<EditableBlock>) => onChange(value.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addBlock = () => {
    const id = newId();
    onChange([...value, { id, type: addType, data: defaultBlockData(addType) }]);
    setOpen((o) => ({ ...o, [id]: true }));
  };

  const addReusableBlock = () => {
    if (!addReusable) return;
    onChange([...value, { id: newId(), type: "reusable", blockId: addReusable }]);
    setAddReusable("");
  };

  const saveAsReusable = async (block: EditableBlock) => {
    if (!isBlockType(block.type)) return;
    const result = await withToast(createContentBlock({ name: reusableName, type: block.type, data: block.data }), {
      success: "Saved as reusable block",
      error: "Couldn't save reusable block",
    });
    if (result.success) {
      setReusable((r) => [...r, { id: result.id, name: reusableName.trim(), type: block.type }].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(value.map((b) => (b.id === block.id ? { id: b.id, type: "reusable", blockId: result.id } : b)));
      setSavingId(null);
      setReusableName("");
    }
  };

  return (
    <div className="space-y-4">
      {value.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-caption">
          No blocks yet. Add a hero, a call to action, a form… below.
        </p>
      )}

      <ol className="space-y-3">
        {value.map((block, index) => {
          const isRef = block.type === "reusable";
          const known = isBlockType(block.type) ? block.type : null;
          const ref = isRef ? reusable.find((r) => r.id === block.blockId) : null;
          const expanded = open[block.id] ?? false;
          const title = isRef ? `Reusable: ${ref?.name ?? "(missing block)"}` : known ? BLOCK_LABELS[known] : "Unknown block";
          return (
            <li key={block.id} className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [block.id]: !expanded }))}
                  aria-expanded={expanded}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-foreground"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {isRef && <Link2 size={14} className="text-brand-orange-deep" />}
                  <span className="truncate">{index + 1}. {title}</span>
                  {isRef && ref && <span className="text-xs font-normal text-caption">({BLOCK_LABELS[ref.type as BlockType] ?? ref.type})</span>}
                </button>
                <button type="button" onClick={() => move(index, -1)} disabled={disabled || index === 0} aria-label="Move block up" className={btn}><ArrowUp size={14} /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1} aria-label="Move block down" className={btn}><ArrowDown size={14} /></button>
                <button type="button" onClick={() => onChange(value.filter((b) => b.id !== block.id))} disabled={disabled} aria-label="Remove block" className={`${btn} hover:text-red-600`}><Trash2 size={14} /></button>
              </div>

              {expanded && (
                <div className="border-t border-border p-4 space-y-4">
                  {isRef ? (
                    <div className="text-sm text-muted space-y-2">
                      {ref ? (
                        <p>
                          This block is shared. Editing it changes every page that uses it.{" "}
                          <Link href={`/admin/blocks/${ref.id}`} className="text-brand-orange-deep dark:text-brand-orange-light underline" target="_blank">Edit “{ref.name}”</Link>
                        </p>
                      ) : (
                        <p className="text-red-600">This reusable block no longer exists, so it is skipped on the public page. Remove it from the list.</p>
                      )}
                    </div>
                  ) : known ? (
                    <>
                      <p className="text-xs text-caption">{BLOCK_HELP[known]}</p>
                      <BlockFields fields={BLOCK_FIELDS[known]} value={block.data ?? {}} onChange={(data) => update(block.id, { data })} options={options} idPrefix={block.id} />
                      <div className="border-t border-border pt-3">
                        {savingId === block.id ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-48">
                              <label htmlFor={`${block.id}-reuse-name`} className="block text-xs font-medium text-muted mb-1">Reusable block name</label>
                              <input id={`${block.id}-reuse-name`} value={reusableName} onChange={(e) => setReusableName(e.target.value)} placeholder="e.g. Book a call CTA" className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />
                            </div>
                            <button type="button" onClick={() => saveAsReusable(block)} disabled={!reusableName.trim()} className={btn}>Save</button>
                            <button type="button" onClick={() => setSavingId(null)} className={btn}>Cancel</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setSavingId(block.id); setReusableName(""); }} className="flex items-center gap-1 text-sm text-brand-orange-deep dark:text-brand-orange-light hover:underline">
                            <Save size={14} /> Save as reusable block…
                          </button>
                        )}
                        <p className="mt-1 text-xs text-caption">Saves this block to the shared library and replaces it here with a link to it.</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-red-600">Unknown block type “{block.type}”. Remove it.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-3">
        <div>
          <label htmlFor="add-block-type" className="block text-xs font-medium text-muted mb-1">Add a block</label>
          <select id="add-block-type" value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm">
            {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
          </select>
        </div>
        <button type="button" onClick={addBlock} disabled={disabled} className="flex items-center gap-1 px-3 py-2 bg-brand-orange-deep text-white rounded-lg text-sm hover:bg-brand-orange disabled:opacity-50">
          <Plus size={14} /> Add
        </button>

        <div className="ml-auto flex items-end gap-2">
          <div>
            <label htmlFor="add-reusable" className="block text-xs font-medium text-muted mb-1">Or use a reusable block</label>
            <select id="add-reusable" value={addReusable} onChange={(e) => setAddReusable(e.target.value)} className="px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm min-w-48">
              <option value="">{reusable.length ? "Choose…" : "None created yet"}</option>
              {reusable.map((r) => <option key={r.id} value={r.id}>{r.name} ({BLOCK_LABELS[r.type as BlockType] ?? r.type})</option>)}
            </select>
          </div>
          <button type="button" onClick={addReusableBlock} disabled={disabled || !addReusable} className="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm hover:bg-tint disabled:opacity-40">
            <Link2 size={14} /> Insert
          </button>
        </div>
      </div>
    </div>
  );
}
