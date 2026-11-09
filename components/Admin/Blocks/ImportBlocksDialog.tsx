"use client";

import { useEffect, useRef, useState } from "react";
import { validateImport, type ImportValidationResult } from "@/app/(admin)/actions/blocks";
import { IMPORT_MAX_BYTES, mergeImported, parseImportDocument, summarizeBlocks } from "@/lib/blocks/import";
import { conflictingFields, planFieldMerge } from "@/lib/case-study-import-fields";
import type { EditableBlock } from "./BlocksEditor";

const btn = "px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-tint disabled:opacity-40";

export type SlugConflict = { id: string; title: string; slug: string };
export type ImportApplied = { blocks?: EditableBlock[]; fields?: Record<string, unknown>; slugConflict?: SlugConflict | null };

type Preview = Extract<ImportValidationResult, { success: true }>;

/**
 * "Import JSON". The text is pasted or read from a chosen file in the browser (FileReader — the file itself is never
 * uploaded). It is checked here, validated by the server with the same rules as save (the action writes nothing),
 * previewed, and only then handed to the form. Nothing is stored until the form is saved, which validates again.
 *
 * `target: "blocks"` (pages, pSEO templates) takes only the block list; `"caseStudy"` also takes the form fields and
 * asks what to do with fields the form already has.
 */
export default function ImportBlocksDialog({
  target,
  existing,
  currentFields,
  currentId,
  onImport,
  onClose,
}: {
  target: "blocks" | "caseStudy";
  existing: EditableBlock[];
  currentFields?: Record<string, unknown>;
  currentId?: string;
  onImport: (applied: ImportApplied) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [blockMode, setBlockMode] = useState<"replace" | "append">("append");
  const [fieldMode, setFieldMode] = useState<"overwrite" | "fill-empty">("overwrite");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const reset = (nextText: string) => {
    setText(nextText);
    setPreview(null);
    setError(null);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) {
      reset("");
      setError(`That file is ${Math.ceil(file.size / 1024)} KB; the limit is ${IMPORT_MAX_BYTES / 1024} KB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => reset(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("Couldn't read that file");
    reader.readAsText(file);
  };

  const check = async () => {
    setError(null);
    setPreview(null);
    const parsed = parseImportDocument(text);
    if (!parsed.ok) return setError(parsed.error);
    setBusy(true);
    try {
      const { blocks, fields } = parsed.value;
      const result = await validateImport(blocks ? { ...fields, blocks } : fields, { target, currentId });
      if (!result.success) return setError(result.error);
      setPreview(result);
      setBlockMode(existing.length ? "append" : "replace");
      setFieldMode("overwrite");
    } catch {
      setError("Couldn't validate the import. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const incomingFields = preview ? Object.keys(preview.fields) : [];
  const conflicts = preview && currentFields ? conflictingFields(currentFields, preview.fields) : [];

  const confirm = () => {
    if (!preview) return;
    const applied: ImportApplied = {};
    if (preview.blocks) {
      const merged = mergeImported(existing, preview.blocks as EditableBlock[], existing.length ? blockMode : "replace");
      if (!merged.ok) return setError(merged.error);
      applied.blocks = merged.value;
    }
    if (incomingFields.length) {
      const plan = planFieldMerge(currentFields ?? {}, preview.fields, conflicts.length ? fieldMode : "overwrite");
      applied.fields = plan.apply;
      // Only matters if the imported slug really lands in the form.
      applied.slugConflict = "slug" in plan.apply ? preview.slugConflict : null;
    }
    onImport(applied);
    onClose();
  };

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="import-blocks-title" className="w-full max-w-2xl rounded-xl border border-border bg-card p-0 text-foreground backdrop:bg-black/50">
      <div className="p-5 space-y-4">
        <h2 id="import-blocks-title" className="text-lg font-semibold">{target === "caseStudy" ? "Import case study from JSON" : "Import blocks from JSON"}</h2>
        <p className="text-sm text-caption">
          {target === "caseStudy" ? (
            <>An object with the form&apos;s fields and a <code>blocks</code> list, or just a list of blocks. Status is never imported.</>
          ) : (
            <>A list of blocks: <code>{`[{ "type": "takeaway", "data": { … } }, …]`}</code>.</>
          )}{" "}
          Block ids are not needed — new ones are generated. Nothing is saved until you save the form.
        </p>

        <div>
          <label htmlFor="import-blocks-file" className="block text-xs font-medium text-muted mb-1">Choose a .json file (read in your browser, not uploaded)</label>
          <input id="import-blocks-file" type="file" accept=".json,application/json" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} className="text-sm" />
        </div>
        <div>
          <label htmlFor="import-blocks-text" className="block text-xs font-medium text-muted mb-1">…or paste JSON</label>
          <textarea id="import-blocks-text" rows={10} value={text} onChange={(e) => reset(e.target.value)} spellCheck={false} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs font-mono" />
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {preview && (
          <div className="rounded-lg border border-border bg-background p-3 space-y-3 text-sm">
            <p><strong>Valid.</strong></p>
            {incomingFields.length > 0 && <p>{incomingFields.length} field{incomingFields.length === 1 ? "" : "s"}: <span className="text-muted">{incomingFields.join(", ")}</span></p>}
            {preview.blocks && <p>{summarizeBlocks(preview.blocks)}</p>}

            {preview.slugConflict && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
                A case study with the slug “{preview.slugConflict.slug}” already exists (“{preview.slugConflict.title}”). You can still load the file, but saving will fail until you change the slug.
              </p>
            )}

            {preview.warnings.length > 0 && (
              <div className="rounded-lg bg-amber-50 p-3 text-amber-900">
                <p className="font-semibold">Warnings</p>
                <ul className="list-disc pl-5 space-y-0.5">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            {conflicts.length > 0 && (
              <fieldset className="space-y-1">
                <legend className="font-semibold">{conflicts.length} field{conflicts.length === 1 ? "" : "s"} already {conflicts.length === 1 ? "has" : "have"} content: <span className="font-normal text-muted">{conflicts.join(", ")}</span></legend>
                <label className="flex items-center gap-2"><input type="radio" name="import-field-mode" checked={fieldMode === "overwrite"} onChange={() => setFieldMode("overwrite")} /> Overwrite them with the file&apos;s values</label>
                <label className="flex items-center gap-2"><input type="radio" name="import-field-mode" checked={fieldMode === "fill-empty"} onChange={() => setFieldMode("fill-empty")} /> Only fill empty fields (keep what&apos;s there)</label>
              </fieldset>
            )}

            {preview.blocks && existing.length > 0 && (
              <div role="radiogroup" aria-label="How to load blocks" className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="radio" name="import-mode" checked={blockMode === "append"} onChange={() => setBlockMode("append")} /> Append to the {existing.length} existing block{existing.length === 1 ? "" : "s"}</label>
                <label className="flex items-center gap-2"><input type="radio" name="import-mode" checked={blockMode === "replace"} onChange={() => setBlockMode("replace")} /> Replace all existing blocks</label>
              </div>
            )}
            <p className="text-xs text-caption">You can still review and edit everything before saving.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn}>Cancel</button>
          {preview ? (
            <button type="button" onClick={confirm} className="px-3 py-1.5 bg-brand-orange-deep text-white rounded-lg text-sm hover:bg-brand-orange">
              {incomingFields.length ? "Load into form" : blockMode === "replace" && existing.length ? "Replace blocks" : "Load blocks"}
            </button>
          ) : (
            <button type="button" onClick={check} disabled={busy || !text.trim()} className="px-3 py-1.5 bg-brand-orange-deep text-white rounded-lg text-sm hover:bg-brand-orange disabled:opacity-50">
              {busy ? "Checking…" : "Check JSON"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
