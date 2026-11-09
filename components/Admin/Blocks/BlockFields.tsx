"use client";

import dynamic from "next/dynamic";
import { Plus, Trash2 } from "lucide-react";
import ImageInput from "../Media/ImageInput";
import type { FieldDef } from "@/lib/blocks/fields";

// Same editor the classic Content field uses; client-only because of TipTap.
const RichTextEditor = dynamic(() => import("../Editor"), { ssr: false });

export type PickerOptions = Record<"testimonials" | "faqs" | "packages", { value: string; label: string }[]>;
// Block data is free-form JSON here; the zod schemas in lib/blocks/schema.ts are what validate it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldValues = Record<string, any>;

const inputClass = "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-brand-orange";
const labelClass = "block text-xs font-medium text-muted mb-1";

// One generic renderer for every block type: it walks the declarative definitions in lib/blocks/fields.ts. Values are
// plain JSON; the server (lib/blocks/schema.ts) is the only validator that matters, so this never trims or rejects.
export default function BlockFields({
  fields,
  value,
  onChange,
  options,
  idPrefix,
}: {
  fields: FieldDef[];
  value: FieldValues;
  onChange: (next: FieldValues) => void;
  options: PickerOptions;
  idPrefix: string;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if ("showWhen" in field && field.showWhen && String(value[field.showWhen.key] ?? "") !== field.showWhen.equals) return null;
        const id = `${idPrefix}-${field.key}`;
        const current = value[field.key];

        switch (field.kind) {
          case "text":
          case "url":
            return (
              <div key={field.key}>
                <label htmlFor={id} className={labelClass}>{field.label}</label>
                <input id={id} type="text" inputMode={field.kind === "url" ? "url" : undefined} value={current ?? ""} placeholder={field.placeholder} onChange={(e) => set(field.key, e.target.value)} className={inputClass} />
                {field.help && <p className="mt-1 text-xs text-caption">{field.help}</p>}
              </div>
            );

          case "textarea":
            return (
              <div key={field.key}>
                <label htmlFor={id} className={labelClass}>{field.label}</label>
                <textarea id={id} rows={field.rows ?? 3} value={current ?? ""} placeholder={field.placeholder} onChange={(e) => set(field.key, e.target.value)} className={inputClass} />
                {field.help && <p className="mt-1 text-xs text-caption">{field.help}</p>}
              </div>
            );

          case "image":
            return (
              <div key={field.key}>
                <span className={labelClass}>{field.label}</span>
                <ImageInput folder="Landing pages" value={current ?? ""} onChange={(url) => set(field.key, url)} previewClassName="w-32 h-20" />
              </div>
            );

          case "richtext":
            return (
              <div key={field.key}>
                <span className={labelClass}>{field.label}</span>
                <RichTextEditor content={current ?? ""} onChange={(html) => set(field.key, html)} />
              </div>
            );

          case "toggle":
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={Boolean(current)} onChange={(e) => set(field.key, e.target.checked)} className="w-4 h-4 rounded border-border" />
                {field.label}
              </label>
            );

          case "select":
            return (
              <div key={field.key}>
                <label htmlFor={id} className={labelClass}>{field.label}</label>
                <select id={id} value={String(current ?? field.options[0]?.value)} onChange={(e) => set(field.key, e.target.value)} className={inputClass}>
                  {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            );

          case "picker": {
            const choices = options[field.source];
            const selected: string[] = Array.isArray(current) ? current : [];
            return (
              <fieldset key={field.key}>
                <legend className={labelClass}>{field.label}</legend>
                {choices.length === 0 ? (
                  <p className="text-xs text-caption">Nothing in this library yet.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                    {choices.map((c) => (
                      <label key={c.value} className="flex items-start gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.value)}
                          onChange={(e) => set(field.key, e.target.checked ? [...selected, c.value] : selected.filter((x) => x !== c.value))}
                          className="mt-1 w-4 h-4 rounded border-border"
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {field.help && <p className="mt-1 text-xs text-caption">{field.help}</p>}
              </fieldset>
            );
          }

          case "table": {
            // Columns live in `columnsKey`, rows (arrays of cell strings, one per column) in `field.key`.
            const cols: string[] = Array.isArray(value[field.columnsKey]) ? value[field.columnsKey] : [];
            const rows: string[][] = Array.isArray(current) ? current : [];
            const cell = (row: string[], c: number) => (typeof row[c] === "string" ? row[c] : "");
            const setCols = (next: string[]) => onChange({ ...value, [field.columnsKey]: next, [field.key]: rows.map((r) => next.map((_, c) => cell(r, c))) });
            const setCell = (r: number, c: number, v: string) => set(field.key, rows.map((row, i) => (i === r ? cols.map((_, k) => (k === c ? v : cell(row, k))) : row)));
            const small = "w-full min-w-28 px-2 py-1.5 border border-border rounded bg-background text-foreground text-sm";
            const link = "flex items-center gap-1 text-sm text-brand-orange-deep dark:text-brand-orange-light hover:underline disabled:opacity-40";
            return (
              <fieldset key={field.key} className="space-y-2">
                <legend className={labelClass}>{field.label}</legend>
                <div className="overflow-x-auto">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        {cols.map((h, c) => (
                          <th key={c} className="p-1 align-bottom">
                            <input aria-label={`Column ${c + 1} header`} value={h} placeholder={`Column ${c + 1}`} onChange={(e) => setCols(cols.map((x, k) => (k === c ? e.target.value : x)))} className={`${small} font-semibold`} />
                          </th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, r) => (
                        <tr key={r}>
                          {cols.map((_, c) => (
                            <td key={c} className="p-1">
                              <input aria-label={`Row ${r + 1}, ${cols[c] || `column ${c + 1}`}`} value={cell(row, c)} onChange={(e) => setCell(r, c, e.target.value)} className={small} />
                            </td>
                          ))}
                          <td className="p-1">
                            <button type="button" onClick={() => set(field.key, rows.filter((_, i) => i !== r))} aria-label={`Remove row ${r + 1}`} className="text-caption hover:text-red-600"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button type="button" disabled={rows.length >= field.maxRows} onClick={() => set(field.key, [...rows, cols.map(() => "")])} className={link}><Plus size={14} /> Add row</button>
                  <button type="button" disabled={cols.length >= field.maxColumns} onClick={() => setCols([...cols, ""])} className={link}><Plus size={14} /> Add column</button>
                  <button type="button" disabled={cols.length <= 1} onClick={() => setCols(cols.slice(0, -1))} className="text-sm text-caption hover:text-red-600 disabled:opacity-40">Remove last column</button>
                </div>
                {field.help && <p className="text-xs text-caption">{field.help}</p>}
              </fieldset>
            );
          }

          case "list": {
            const items: FieldValues[] = Array.isArray(current) ? current : [];
            const blank = () => Object.fromEntries(field.fields.map((f) => [f.key, f.kind === "toggle" ? false : f.kind === "list" || f.kind === "picker" ? [] : ""]));
            return (
              <fieldset key={field.key} className="space-y-3">
                <legend className={labelClass}>{field.label}</legend>
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">{field.itemLabel} {i + 1}</span>
                      <button type="button" onClick={() => set(field.key, items.filter((_, j) => j !== i))} aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`} className="text-caption hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <BlockFields
                      fields={field.fields}
                      value={item}
                      onChange={(next) => set(field.key, items.map((x, j) => (j === i ? next : x)))}
                      options={options}
                      idPrefix={`${id}-${i}`}
                    />
                  </div>
                ))}
                <button type="button" onClick={() => set(field.key, [...items, blank()])} className="flex items-center gap-1 text-sm text-brand-orange-deep dark:text-brand-orange-light hover:underline">
                  <Plus size={14} /> Add {field.itemLabel.toLowerCase()}
                </button>
              </fieldset>
            );
          }
        }
      })}
    </div>
  );
}
