"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { applyPricingImport, exportPricingData, getPricingTemplate, previewPricingImport, type ImportPreview } from "@/app/(admin)/actions/pricing";
import { downloadCsv, downloadXlsx, readUpload } from "@/lib/pricing/import/client-files";
import { LIMITS } from "@/lib/pricing/import/sheets";
import type { RawWorkbook } from "@/lib/pricing/import/parse";
import type { EntityName, ImportMode } from "@/lib/pricing/import/plan";
import { confirmDialog } from "@/lib/admin/dialog";
import { toast } from "@/lib/admin/toast";
import { Card, btnGhost, btnPrimary } from "./ui";

const ENTITY_LABEL: Record<EntityName, string> = {
  settings: "Settings", currencies: "Currencies", packages: "Packages", prices: "Prices", features: "Features",
  comparisonRows: "Comparison rows", comparisonCells: "Comparison cells", policies: "Policies", policyTexts: "Policy currency texts",
};

export default function ImportExport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [workbook, setWorkbook] = useState<RawWorkbook | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview["plan"] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [csvSheets, setCsvSheets] = useState<{ name: string; rows: (string | number)[][] }[]>([]);

  const reset = () => { setWorkbook(null); setPreview(null); setFileNames([]); setDone(false); setError(null); if (fileRef.current) fileRef.current.value = ""; };

  const template = async () => {
    setBusy("template");
    const res = await getPricingTemplate();
    if (res.success) await downloadXlsx("pricing-import-template.xlsx", res.sheets);
    else toast.error("Couldn't build template", { description: res.error });
    setBusy(null);
  };

  const exportAll = async () => {
    setBusy("export");
    const res = await exportPricingData();
    if (res.success) { await downloadXlsx(`pricing-export-${new Date().toISOString().slice(0, 10)}.xlsx`, res.sheets); setCsvSheets(res.sheets); }
    else toast.error("Couldn't export", { description: res.error });
    setBusy(null);
  };

  const check = async (mode2: ImportMode = mode) => {
    setError(null); setDone(false);
    const files = Array.from(fileRef.current?.files ?? []);
    setBusy("check");
    try {
      const read = await readUpload(files);
      if ("error" in read) { setError(read.error); setPreview(null); setWorkbook(null); return; }
      setWorkbook(read.workbook); setFileNames(read.fileNames);
      const res = await previewPricingImport(read.workbook, mode2);
      if (!res.success) { setError(res.error); setPreview(null); return; }
      setPreview(res.plan);
    } finally { setBusy(null); }
  };

  const confirm = async () => {
    if (!workbook || !preview) return;
    if (mode === "replace") {
      const total = Object.values(preview.counts).reduce((n, c) => n + c.delete, 0);
      const ok = await confirmDialog({
        title: "Replace ALL pricing content?",
        text: `Everything currently saved (${total} record${total === 1 ? "" : "s"}) is deleted first, then replaced by this file - in one step. This cannot be undone.`,
        confirmText: "Replace everything", danger: true,
      });
      if (!ok) return;
    } else {
      const ok = await confirmDialog({ title: "Import this file?", text: "Missing records are created and existing ones updated. Nothing is deleted.", confirmText: "Import" });
      if (!ok) return;
    }
    setBusy("import");
    try {
      const res = await applyPricingImport(workbook, mode);
      if (!res.success) { setError(res.error); toast.error("Import failed", { description: res.error }); return; }
      toast.success("Import complete");
      setDone(true); setPreview(res.plan); setWorkbook(null);
      router.refresh();
    } finally { setBusy(null); }
  };

  const errors = preview?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = preview?.issues.filter((i) => i.level === "warning") ?? [];
  const canImport = !!preview && !done && errors.length === 0 && !busy;
  const nothing = preview && Object.values(preview.counts).every((c) => c.create + c.update + c.delete === 0);

  return (
    <div className="space-y-6">
      <Card title="1 · Get the format" hint="The template has a sheet per entity, an Instructions sheet and an Examples sheet. Instructions and Examples are never imported. Export uses exactly the same format, so you can edit and re-import it.">
        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnGhost} onClick={template} disabled={!!busy}><FileSpreadsheet size={16} /> Download template (.xlsx)</button>
          <button type="button" className={btnGhost} onClick={exportAll} disabled={!!busy}><Download size={16} /> Export current data (.xlsx)</button>
        </div>
        {csvSheets.length > 0 && (
          <p className="text-sm text-caption mt-3">
            Or as CSV (one file per sheet):{" "}
            {csvSheets.map((s) => (
              <button key={s.name} type="button" className="underline mr-3 text-brand-orange-deep dark:text-brand-orange-light" onClick={() => downloadCsv(`${s.name}.csv`, s.rows)}>{s.name}</button>
            ))}
          </p>
        )}
      </Card>

      <Card title="2 · Upload and check" hint={`.xlsx (all sheets in one file) or .csv (one file per sheet, named after the sheet, e.g. Prices.csv). Max ${LIMITS.maxFileBytes / 1024 / 1024} MB. Nothing is saved at this step.`}>
        <div className="space-y-4">
          <input ref={fileRef} type="file" accept=".xlsx,.csv" multiple onChange={() => { setPreview(null); setDone(false); setError(null); }} aria-label="Pricing file" className="block text-sm text-foreground file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-border file:bg-background file:text-foreground" />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-muted mb-1">Mode</legend>
            <label className="flex items-start gap-2 text-sm text-foreground"><input type="radio" name="mode" className="mt-1 accent-[#c4491a]" checked={mode === "merge"} onChange={() => { setMode("merge"); setPreview(null); }} /><span><strong>Merge</strong> - create missing records and update existing ones. Nothing is deleted.</span></label>
            <label className="flex items-start gap-2 text-sm text-foreground"><input type="radio" name="mode" className="mt-1 accent-[#c4491a]" checked={mode === "replace"} onChange={() => { setMode("replace"); setPreview(null); }} /><span><strong className="text-red-600">Replace all</strong> - deletes all existing pricing content first, then loads the file. Asks for confirmation.</span></label>
          </fieldset>
          <button type="button" className={btnPrimary} onClick={() => check()} disabled={!!busy}><Upload size={16} /> {busy === "check" ? "Checking…" : "Check file (dry run)"}</button>
        </div>
        {error && <p role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-600"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
      </Card>

      {preview && (
        <Card title={done ? "Import complete" : "3 · Review and confirm"} hint={fileNames.join(", ")}>
          {done && <p className="flex items-center gap-2 text-sm text-green-600 mb-3"><CheckCircle2 size={16} /> Saved. The public /pricing page has been refreshed.</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead><tr className="text-left text-caption"><th className="py-2 pr-3 font-medium">Records</th><th className="py-2 pr-3 font-medium">{done ? "Created" : "To create"}</th><th className="py-2 pr-3 font-medium">{done ? "Updated" : "To update"}</th><th className="py-2 pr-3 font-medium">Unchanged</th>{preview.mode === "replace" && <th className="py-2 font-medium text-red-600">{done ? "Deleted first" : "To delete first"}</th>}</tr></thead>
              <tbody className="divide-y divide-border">
                {(Object.keys(ENTITY_LABEL) as EntityName[]).map((k) => {
                  const c = preview.counts[k];
                  if (c.create + c.update + c.unchanged + c.delete === 0) return null;
                  return (
                    <tr key={k}><th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">{ENTITY_LABEL[k]}</th><td className="py-2 pr-3">{c.create}</td><td className="py-2 pr-3">{c.update}</td><td className="py-2 pr-3 text-caption">{c.unchanged}</td>{preview.mode === "replace" && <td className="py-2 text-red-600">{c.delete}</td>}</tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {nothing && !done && errors.length === 0 && <p className="text-sm text-caption mt-3">This file would not change anything.</p>}

          {errors.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600"><AlertCircle size={16} /> {errors.length} error{errors.length === 1 ? "" : "s"} - fix the file and check again</h3>
              <ul className="mt-2 max-h-72 overflow-auto text-sm space-y-1">
                {errors.map((e, i) => <li key={i} className="text-foreground"><span className="text-caption">{e.sheet}{e.row ? ` · row ${e.row}` : ""}:</span> {e.message}</li>)}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600"><AlertTriangle size={16} /> {warnings.length} warning{warnings.length === 1 ? "" : "s"}</h3>
              <ul className="mt-2 max-h-48 overflow-auto text-sm space-y-1">
                {warnings.map((e, i) => <li key={i} className="text-foreground"><span className="text-caption">{e.sheet}{e.row ? ` · row ${e.row}` : ""}:</span> {e.message}</li>)}
              </ul>
            </div>
          )}

          {!done && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className={mode === "replace" ? "inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50" : btnPrimary} onClick={confirm} disabled={!canImport}>
                {busy === "import" ? "Importing…" : mode === "replace" ? "Replace everything…" : "Confirm import"}
              </button>
              <button type="button" className={btnGhost} onClick={reset} disabled={!!busy}>Cancel</button>
            </div>
          )}
          {done && <button type="button" className={`${btnGhost} mt-4`} onClick={reset}>Import another file</button>}
        </Card>
      )}
    </div>
  );
}
