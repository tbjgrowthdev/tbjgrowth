"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createRedirect, updateRedirect, deleteRedirect, bulkImportRedirects } from "@/app/(admin)/actions/redirects";
import { AlertCircle, AlertTriangle, CheckCircle2, Plus, Upload, Search, Pencil, X, Save, Link2, RotateCw, Copy } from "lucide-react";
import DeleteButton from "./DeleteButton";

type RedirectItem = {
  id: string;
  source: string;
  destination: string | null;
  statusCode: number;
  createdAt: string | Date;
};

type RedirectIssue = {
  type: "chain" | "loop" | "duplicate";
  description: string;
  sources: string[];
};

const STATUS_LABEL: Record<number, { label: string; className: string }> = {
  301: { label: "301 Permanent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  302: { label: "302 Temporary", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  307: { label: "307 Temporary", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  410: { label: "410 Gone", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const ISSUE_ICON = { chain: Link2, loop: RotateCw, duplicate: Copy };
const ISSUE_LABEL = { chain: "Redirect Chain", loop: "Redirect Loop", duplicate: "Duplicate Redirect" };

export default function RedirectsManager({ redirects, diagnostics }: { redirects: RedirectItem[]; diagnostics: RedirectIssue[] }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [statusCode, setStatusCode] = useState(301);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editDestination, setEditDestination] = useState("");
  const [editStatusCode, setEditStatusCode] = useState(301);
  const [isSaving, setIsSaving] = useState(false);

  const flaggedSources = useMemo(() => new Set(diagnostics.flatMap((d) => d.sources)), [diagnostics]);

  const filteredRedirects = useMemo(() => {
    if (!search.trim()) return redirects;
    const q = search.toLowerCase();
    return redirects.filter((r) => r.source.toLowerCase().includes(q) || r.destination?.toLowerCase().includes(q));
  }, [redirects, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createRedirect({ source, destination: statusCode === 410 ? undefined : destination, statusCode });
    if (result.success) {
      setSource("");
      setDestination("");
      router.refresh();
    } else {
      setError(result.error || "Failed to create redirect");
    }
    setIsSubmitting(false);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    const result = await bulkImportRedirects(csvText);
    setImportResult(`Imported ${result.created}, skipped ${result.skipped}${result.errors.length ? `, ${result.errors.length} errors` : ""}.`);
    setCsvText("");
    router.refresh();
    setIsImporting(false);
  };

  const startEdit = (r: RedirectItem) => {
    setEditingId(r.id);
    setEditSource(r.source);
    setEditDestination(r.destination || "");
    setEditStatusCode(r.statusCode);
    setError(null);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    const result = await updateRedirect(editingId, {
      source: editSource,
      destination: editStatusCode === 410 ? undefined : editDestination,
      statusCode: editStatusCode,
    });
    if (result.success) {
      setEditingId(null);
      router.refresh();
    } else {
      setError(result.error || "Failed to update redirect");
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {diagnostics.length > 0 && (
        <div className="bg-card p-4 rounded-lg shadow-sm border border-amber-300 dark:border-amber-900/50 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            {diagnostics.length} issue{diagnostics.length > 1 ? "s" : ""} detected
          </h3>
          <div className="space-y-2">
            {diagnostics.map((issue, i) => {
              const Icon = ISSUE_ICON[issue.type];
              return (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Icon size={14} className="mt-0.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{ISSUE_LABEL[issue.type]}: </span>
                    <span className="text-caption font-mono text-xs">{issue.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-3 items-end"
      >
        <div className="flex-1 w-full space-y-1">
          <label className="block text-xs font-medium text-caption">Source path</label>
          <input
            type="text"
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="/old-page"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        {statusCode !== 410 && (
          <div className="flex-1 w-full space-y-1">
            <label className="block text-xs font-medium text-caption">Destination path</label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="/new-page"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        )}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-caption">Status</label>
          <select
            value={statusCode}
            onChange={(e) => setStatusCode(Number(e.target.value))}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            <option value={301}>301 Permanent</option>
            <option value={302}>302 Temporary</option>
            <option value={307}>307 Temporary</option>
            <option value={410}>410 Gone</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Plus size={18} />
          Add
        </button>
      </form>

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Bulk Import</h3>
        <p className="text-xs text-caption">
          One redirect per line: <code>source,destination,statusCode</code> (statusCode optional, defaults to 301; leave destination blank for a 410).
        </p>
        <textarea
          rows={4}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"/old-blog-post,/blog/new-post,301\n/promo,/services,302\n/discontinued-page,,410"}
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange font-mono text-sm"
        />
        {importResult && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 size={16} />
            {importResult}
          </div>
        )}
        <button
          onClick={handleImport}
          disabled={isImporting || !csvText.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          {isImporting ? "Importing..." : "Import"}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-caption" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by source or destination..."
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
        />
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Source</th>
              <th className="px-6 py-4 font-medium text-caption">Destination</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRedirects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  {redirects.length === 0 ? "No redirects configured yet." : "No redirects match your search."}
                </td>
              </tr>
            ) : (
              filteredRedirects.map((r) => {
                const isEditing = editingId === r.id;
                const flagged = flaggedSources.has(r.source);
                return (
                  <tr key={r.id} className={`hover:bg-background transition-colors ${flagged ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                    {isEditing ? (
                      <>
                        <td className="px-6 py-3">
                          <input
                            type="text"
                            value={editSource}
                            onChange={(e) => setEditSource(e.target.value)}
                            className="w-full px-2 py-1 border border-border rounded bg-background text-foreground font-mono text-sm"
                          />
                        </td>
                        <td className="px-6 py-3">
                          {editStatusCode !== 410 ? (
                            <input
                              type="text"
                              value={editDestination}
                              onChange={(e) => setEditDestination(e.target.value)}
                              className="w-full px-2 py-1 border border-border rounded bg-background text-foreground font-mono text-sm"
                            />
                          ) : (
                            <span className="text-caption text-xs italic">(none)</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <select
                            value={editStatusCode}
                            onChange={(e) => setEditStatusCode(Number(e.target.value))}
                            className="px-2 py-1 border border-border rounded bg-background text-foreground text-sm"
                          >
                            <option value={301}>301</option>
                            <option value={302}>302</option>
                            <option value={307}>307</option>
                            <option value={410}>410</option>
                          </select>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button type="button" disabled={isSaving} onClick={saveEdit} className="text-green-600 hover:text-green-800 disabled:opacity-50">
                              <Save size={18} />
                            </button>
                            <button type="button" onClick={cancelEdit} className="text-caption hover:text-foreground">
                              <X size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 font-mono text-sm text-foreground">
                          {r.source}
                          {flagged && <AlertTriangle size={12} className="inline ml-1.5 text-amber-500" />}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-caption">{r.destination || <em className="italic">(none)</em>}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_LABEL[r.statusCode]?.className || ""}`}>
                            {STATUS_LABEL[r.statusCode]?.label || r.statusCode}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => startEdit(r)} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light">
                              <Pencil size={16} />
                            </button>
                            <DeleteButton id={r.id} onDelete={deleteRedirect} entityName="redirect" />
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
