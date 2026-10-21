"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { getChangeImpactAction } from "@/app/(admin)/actions/seo-change-log";
import type { ChangeImpact } from "@/lib/seo-change-log/impact";
import type { SeoChangeEntry, SeoChangeField } from "@/lib/seo-change-log/types";
import type { ExperimentContentType } from "@/lib/seo-experiments/types";

const TYPE_LABEL: Record<ExperimentContentType, string> = {
  POST: "Blog Post",
  PAGE: "Page",
  CASE_STUDY: "Case Study",
  SERVICE: "Service",
};

function formatValue(field: SeoChangeField, value: string | null): string {
  if (value === null) return "(empty)";
  if (field === "isIndexable" || field === "allowFollow") return value === "true" ? "Yes" : "No";
  if (value.length > 140) return `${value.slice(0, 140)}…`;
  return value;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ImpactPanel({ entry }: { entry: SeoChangeEntry }) {
  const [windowDays, setWindowDays] = useState(28);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impact, setImpact] = useState<ChangeImpact | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await getChangeImpactAction(entry.contentType, entry.contentId, entry.changedAt.toISOString(), windowDays);
    setLoading(false);
    if (result.success) setImpact(result.data);
    else setError(result.error);
  };

  return (
    <div className="px-6 py-4 bg-background border-t border-border space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-caption">Window (days)</label>
        <input
          type="number"
          min={1}
          value={windowDays}
          onChange={(e) => setWindowDays(Number(e.target.value))}
          className="w-20 px-2 py-1 border border-border rounded bg-card text-foreground text-sm"
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50"
        >
          <RefreshCw size={14} />
          {loading ? "Comparing…" : impact ? "Recalculate" : "Compare Before / After"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {impact && (
        <div className="space-y-2">
          {!impact.isWindowComplete && (
            <p className="text-xs text-caption">
              Evaluation window in progress — {impact.daysElapsed} day(s) elapsed, {impact.daysRemaining} remaining. Figures below are a partial preview.
            </p>
          )}
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 font-medium text-caption">Metric</th>
                <th className="py-2 font-medium text-caption">Before ({impact.results.before.days}d)</th>
                <th className="py-2 font-medium text-caption">After ({impact.results.after.days}d)</th>
                <th className="py-2 font-medium text-caption">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 text-foreground">Clicks</td>
                <td className="py-2 text-caption">{impact.results.before.clicks}</td>
                <td className="py-2 text-caption">{impact.results.after.clicks}</td>
                <td className="py-2 text-caption">{formatPct(impact.results.deltas.clicksPct)}</td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">Impressions</td>
                <td className="py-2 text-caption">{impact.results.before.impressions}</td>
                <td className="py-2 text-caption">{impact.results.after.impressions}</td>
                <td className="py-2 text-caption">{formatPct(impact.results.deltas.impressionsPct)}</td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">CTR</td>
                <td className="py-2 text-caption">{(impact.results.before.ctr * 100).toFixed(2)}%</td>
                <td className="py-2 text-caption">{(impact.results.after.ctr * 100).toFixed(2)}%</td>
                <td className="py-2 text-caption">{formatPct(impact.results.deltas.ctrPct)}</td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">Avg. Position</td>
                <td className="py-2 text-caption">{impact.results.before.position?.toFixed(1) ?? "—"}</td>
                <td className="py-2 text-caption">{impact.results.after.position?.toFixed(1) ?? "—"}</td>
                <td className="py-2 text-caption">
                  {impact.results.deltas.positionChange != null ? impact.results.deltas.positionChange.toFixed(1) : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">Sessions</td>
                <td className="py-2 text-caption">{impact.results.before.sessions}</td>
                <td className="py-2 text-caption">{impact.results.after.sessions}</td>
                <td className="py-2 text-caption">{formatPct(impact.results.deltas.sessionsPct)}</td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">Conversions</td>
                <td className="py-2 text-caption">{impact.results.before.conversions}</td>
                <td className="py-2 text-caption">{impact.results.after.conversions}</td>
                <td className="py-2 text-caption">{formatPct(impact.results.deltas.conversionsPct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SeoChangeLogClient({ entries }: { entries: SeoChangeEntry[] }) {
  const [contentTypeFilter, setContentTypeFilter] = useState<"ALL" | ExperimentContentType>("ALL");
  const [fieldFilter, setFieldFilter] = useState<"ALL" | SeoChangeField>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fieldOptions = useMemo(() => {
    const seen = new Map<SeoChangeField, string>();
    for (const e of entries) seen.set(e.field, e.fieldLabel);
    return Array.from(seen.entries());
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) => (contentTypeFilter === "ALL" || e.contentType === contentTypeFilter) && (fieldFilter === "ALL" || e.field === fieldFilter)
      ),
    [entries, contentTypeFilter, fieldFilter]
  );

  const selectClass = "px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm";

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value as typeof contentTypeFilter)} className={selectClass}>
          <option value="ALL">All content types</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value as typeof fieldFilter)} className={selectClass}>
          <option value="ALL">All fields</option>
          {fieldOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-3 font-medium text-caption">Date</th>
              <th className="px-6 py-3 font-medium text-caption">Content</th>
              <th className="px-6 py-3 font-medium text-caption">Field</th>
              <th className="px-6 py-3 font-medium text-caption">Old → New</th>
              <th className="px-6 py-3 font-medium text-caption">By</th>
              <th className="px-6 py-3 font-medium text-caption" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No SEO field changes recorded yet.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <Fragment key={e.id}>
                  <tr className="hover:bg-background transition-colors align-top">
                    <td className="px-6 py-4 text-caption whitespace-nowrap">{formatDate(e.changedAt)}</td>
                    <td className="px-6 py-4 text-foreground">
                      <div className="font-medium">{e.contentTitle ?? "(deleted)"}</div>
                      <div className="flex items-center gap-2 text-xs text-caption">
                        {TYPE_LABEL[e.contentType]}
                        {e.contentPath && (
                          <Link href={e.contentPath} target="_blank" className="flex items-center gap-1 hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                            {e.contentPath} <ExternalLink size={11} />
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-caption whitespace-nowrap">{e.fieldLabel}</td>
                    <td className="px-6 py-4 text-sm max-w-md">
                      <div className="text-caption line-through break-words">{formatValue(e.field, e.oldValue)}</div>
                      <div className="text-foreground font-medium break-words">{formatValue(e.field, e.newValue)}</div>
                    </td>
                    <td className="px-6 py-4 text-caption text-sm whitespace-nowrap">{e.changedBy ?? "—"}</td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        className="flex items-center gap-1 text-sm text-brand-orange-deep dark:text-brand-orange-light hover:underline whitespace-nowrap"
                      >
                        Impact {expanded === e.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <ImpactPanel entry={e} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
