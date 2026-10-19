"use client";

import { useState } from "react";
import { runGscImport, getGscData } from "@/app/(admin)/actions/gsc-import";
import type { GscData } from "@/app/(admin)/actions/gsc-import";
import { Download, AlertCircle, CheckCircle2, Filter } from "lucide-react";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  POST: "Blog Post",
  PAGE: "Page",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function GscImportManager({
  initialData,
  defaultStartDate,
  defaultEndDate,
}: {
  initialData: GscData;
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const [data, setData] = useState(initialData);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [country, setCountry] = useState("");
  const [device, setDevice] = useState("");

  const [importing, setImporting] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const refreshData = async () => {
    const result = await getGscData({ startDate, endDate, country: country || undefined, device: device || undefined });
    setData(result);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setImportMsg(null);
    const result = await runGscImport(startDate, endDate);
    if (result.success && result.result) {
      setImportMsg(
        `Imported ${result.result.rowsImported.toLocaleString()} rows — ${result.result.mappedToContent.toLocaleString()} mapped to CMS content, ${result.result.unmapped.toLocaleString()} unmapped.`
      );
      await refreshData();
    } else {
      setError(result.error || "Import failed");
    }
    setImporting(false);
  };

  const handleApplyFilters = async () => {
    setLoadingFilters(true);
    setError(null);
    await refreshData();
    setLoadingFilters(false);
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
      {importMsg && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center gap-2 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle2 size={20} />
          {importMsg}
        </div>
      )}

      <div className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-caption">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-caption">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-caption">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">All</option>
            {data.countries.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-caption">Device</label>
          <select
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            <option value="">All</option>
            {data.devices.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleApplyFilters}
          disabled={loadingFilters}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-tint transition-colors disabled:opacity-50"
        >
          <Filter size={16} />
          {loadingFilters ? "Loading..." : "Apply Filters"}
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {importing ? "Importing..." : "Import from Search Console"}
        </button>
      </div>

      <p className="text-xs text-caption">
        {data.totalRows.toLocaleString()} rows in the selected range/filters · Last import:{" "}
        {data.lastImportedAt ? new Date(data.lastImportedAt).toLocaleString() : "never"}
      </p>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Mapped to CMS Content</h2>
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 font-medium text-caption">Content</th>
                <th className="px-6 py-4 font-medium text-caption">Type</th>
                <th className="px-6 py-4 font-medium text-caption">Clicks</th>
                <th className="px-6 py-4 font-medium text-caption">Impressions</th>
                <th className="px-6 py-4 font-medium text-caption">CTR</th>
                <th className="px-6 py-4 font-medium text-caption">Avg. Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.byContent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-caption">
                    No imported data mapped to CMS content for this range/filters yet.
                  </td>
                </tr>
              ) : (
                data.byContent.map((row) => (
                  <tr key={`${row.contentType}:${row.contentId}`} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{row.title}</div>
                      <div className="text-xs text-caption">{row.path}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-caption">{CONTENT_TYPE_LABEL[row.contentType] || row.contentType}</td>
                    <td className="px-6 py-4 text-foreground">{row.clicks.toLocaleString()}</td>
                    <td className="px-6 py-4 text-foreground">{row.impressions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-foreground">{pct(row.ctr)}</td>
                    <td className="px-6 py-4 text-foreground">{row.position.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Top Queries</h2>
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-4 py-3 font-medium text-caption text-sm">Query</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">Clicks</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">Impr.</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">CTR</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">Pos.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topQueries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-caption text-sm">
                      No query data yet.
                    </td>
                  </tr>
                ) : (
                  data.topQueries.map((q) => (
                    <tr key={q.query} className="hover:bg-background transition-colors text-sm">
                      <td className="px-4 py-3 text-foreground">{q.query}</td>
                      <td className="px-4 py-3 text-foreground">{q.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground">{q.impressions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground">{pct(q.ctr)}</td>
                      <td className="px-4 py-3 text-foreground">{q.position.toFixed(1)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Unmapped Pages</h2>
          <p className="text-xs text-caption mb-2">
            Pages Search Console has data for that don&apos;t match a current Post/Page/Case Study/Service slug — the homepage, listing
            pages, deleted content, or URLs outside the CMS.
          </p>
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background border-b border-border">
                  <th className="px-4 py-3 font-medium text-caption text-sm">Page</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">Clicks</th>
                  <th className="px-4 py-3 font-medium text-caption text-sm">Impr.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.unmappedPages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-caption text-sm">
                      Nothing unmapped.
                    </td>
                  </tr>
                ) : (
                  data.unmappedPages.map((p) => (
                    <tr key={p.page} className="hover:bg-background transition-colors text-sm">
                      <td className="px-4 py-3 text-foreground truncate max-w-[220px]" title={p.page}>
                        {p.page}
                      </td>
                      <td className="px-4 py-3 text-foreground">{p.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-foreground">{p.impressions.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
