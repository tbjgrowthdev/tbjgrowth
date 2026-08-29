"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRedirect, deleteRedirect, bulkImportRedirects } from "@/app/(admin)/actions/redirects";
import { AlertCircle, CheckCircle2, Plus, Upload } from "lucide-react";
import DeleteButton from "./DeleteButton";

type RedirectItem = {
  id: string;
  source: string;
  destination: string;
  permanent: boolean;
  createdAt: string | Date;
};

export default function RedirectsManager({ redirects }: { redirects: RedirectItem[] }) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [permanent, setPermanent] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createRedirect({ source, destination, permanent });
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
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
            className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <div className="flex-1 w-full space-y-1">
          <label className="block text-xs font-medium text-caption">Destination path</label>
          <input
            type="text"
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="/new-page"
            className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-caption">Type</label>
          <select
            value={permanent ? "301" : "302"}
            onChange={(e) => setPermanent(e.target.value === "301")}
            className="px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          >
            <option value="301">301 (Permanent)</option>
            <option value="302">302 (Temporary)</option>
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
          One redirect per line: <code>source,destination,301</code> (permanent flag optional, defaults to 301).
        </p>
        <textarea
          rows={4}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"/old-blog-post,/blog/new-post,301\n/promo,/services,302"}
          className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange font-mono text-sm"
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

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Source</th>
              <th className="px-6 py-4 font-medium text-caption">Destination</th>
              <th className="px-6 py-4 font-medium text-caption">Type</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {redirects.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No redirects configured yet.
                </td>
              </tr>
            ) : (
              redirects.map((r) => (
                <tr key={r.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-foreground">{r.source}</td>
                  <td className="px-6 py-4 font-mono text-sm text-caption">{r.destination}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${r.permanent ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}`}>
                      {r.permanent ? "301" : "302"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteButton id={r.id} onDelete={deleteRedirect} entityName="redirect" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
