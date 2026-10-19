"use client";

import { useState } from "react";
import { runGa4Import, getGa4Data } from "@/app/(admin)/actions/ga4-import";
import type { Ga4Data } from "@/app/(admin)/actions/ga4-import";
import { Download, AlertCircle, CheckCircle2, Filter, ArrowRight } from "lucide-react";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  POST: "Blog Post",
  PAGE: "Page",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function Ga4ImportManager({
  initialData,
  defaultStartDate,
  defaultEndDate,
}: {
  initialData: Ga4Data;
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const [data, setData] = useState(initialData);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const [importing, setImporting] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const refreshData = async () => {
    const result = await getGa4Data({ startDate, endDate });
    setData(result);
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setImportMsg(null);
    const result = await runGa4Import(startDate, endDate);
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
        <button
          onClick={handleApplyFilters}
          disabled={loadingFilters}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-tint transition-colors disabled:opacity-50"
        >
          <Filter size={16} />
          {loadingFilters ? "Loading..." : "Apply Date Range"}
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Download size={16} />
          {importing ? "Importing..." : "Import from GA4"}
        </button>
      </div>

      <p className="text-xs text-caption">
        {data.totalRows.toLocaleString()} rows in the selected range · Last import:{" "}
        {data.lastImportedAt ? new Date(data.lastImportedAt).toLocaleString() : "never"}
      </p>

      {/* SEO -> Traffic -> Conversion funnel */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">SEO → Traffic → Conversion</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-4 rounded-lg bg-stat flex-1 min-w-[140px]">
            <p className="text-xs text-brand-orange-deep dark:text-brand-orange-light font-medium">Organic Sessions</p>
            <p className="text-2xl font-bold text-foreground">{data.totals.sessions.toLocaleString()}</p>
          </div>
          <ArrowRight className="text-caption flex-shrink-0" size={20} />
          <div className="p-4 rounded-lg bg-stat flex-1 min-w-[140px]">
            <p className="text-xs text-brand-orange-deep dark:text-brand-orange-light font-medium">Engagement Rate</p>
            <p className="text-2xl font-bold text-foreground">{pct(data.totals.engagementRate)}</p>
            <p className="text-xs text-caption">{data.totals.engagedSessions.toLocaleString()} engaged sessions</p>
          </div>
          <ArrowRight className="text-caption flex-shrink-0" size={20} />
          <div className="p-4 rounded-lg bg-stat flex-1 min-w-[140px]">
            <p className="text-xs text-brand-orange-deep dark:text-brand-orange-light font-medium">Conversions</p>
            <p className="text-2xl font-bold text-foreground">{data.totals.conversions.toLocaleString()}</p>
          </div>
          <ArrowRight className="text-caption flex-shrink-0" size={20} />
          <div className="p-4 rounded-lg bg-stat flex-1 min-w-[140px]">
            <p className="text-xs text-brand-orange-deep dark:text-brand-orange-light font-medium">Conversion Rate</p>
            <p className="text-2xl font-bold text-foreground">{pct(data.totals.conversionRate)}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">By Landing Page (mapped to CMS content)</h2>
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 font-medium text-caption">Content</th>
                <th className="px-6 py-4 font-medium text-caption">Type</th>
                <th className="px-6 py-4 font-medium text-caption">Organic Sessions</th>
                <th className="px-6 py-4 font-medium text-caption">Engagement Rate</th>
                <th className="px-6 py-4 font-medium text-caption">Conversions</th>
                <th className="px-6 py-4 font-medium text-caption">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.byContent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-caption">
                    No imported organic-traffic data mapped to CMS content for this range yet.
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
                    <td className="px-6 py-4 text-foreground">{row.sessions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-foreground">{pct(row.engagementRate)}</td>
                    <td className="px-6 py-4 text-foreground">{row.conversions.toLocaleString()}</td>
                    <td className="px-6 py-4 text-foreground">{pct(row.conversionRate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Unmapped Landing Pages</h2>
        <p className="text-xs text-caption mb-2">
          Landing pages GA4 has organic-traffic data for that don&apos;t match a current Post/Page/Case Study/Service slug — the
          homepage, listing pages, deleted content, or URLs outside the CMS.
        </p>
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-4 py-3 font-medium text-caption text-sm">Landing Page</th>
                <th className="px-4 py-3 font-medium text-caption text-sm">Sessions</th>
                <th className="px-4 py-3 font-medium text-caption text-sm">Conversions</th>
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
                  <tr key={p.landingPage} className="hover:bg-background transition-colors text-sm">
                    <td className="px-4 py-3 text-foreground truncate max-w-[220px]" title={p.landingPage}>
                      {p.landingPage}
                    </td>
                    <td className="px-4 py-3 text-foreground">{p.sessions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-foreground">{p.conversions.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
