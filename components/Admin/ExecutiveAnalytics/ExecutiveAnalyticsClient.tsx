"use client";

import { useState } from "react";
import Link from "next/link";
import { getExecutiveAnalyticsAction } from "@/app/(admin)/actions/executive-analytics";
import { WINDOW_OPTIONS, type ExecutiveAnalyticsData } from "@/lib/executive-analytics/types";

const GRADE_STYLE: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  GOOD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  NEEDS_ATTENTION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  POOR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const REFRESH_STATUS_STYLE: Record<string, string> = {
  DETECTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DRAFTING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  APPLIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-tint text-caption",
};

const MARKET_LABEL: Record<string, string> = { uk: "UK", bangladesh: "Bangladesh", gulf: "Gulf" };

function formatUsd(n: number): string {
  return `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function formatPct(n: number | null): string {
  if (n === null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function titleCase(s: string): string {
  return s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-5">
      <p className="text-xs text-caption font-medium">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {hint && <p className="text-xs text-caption mt-1">{hint}</p>}
    </div>
  );
}

function MiniBarChart({ title, points, color }: { title: string; points: { date: string; value: number }[]; color: string }) {
  const max = Math.max(0.0001, ...points.map((p) => p.value));
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {points.length > 0 ? (
        <div className="flex items-end gap-0.5 h-20">
          {points.map((p) => (
            <div
              key={p.date}
              title={`${p.date}: ${p.value.toLocaleString()}`}
              className={`flex-1 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity ${color}`}
              style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-caption">No data in this window yet.</p>
      )}
    </div>
  );
}

function DistributionBar({ counts, styleMap }: { counts: Record<string, number>; styleMap: Record<string, string> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0) return <p className="text-sm text-caption">No data yet.</p>;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-background">
        {entries.map(([key, n]) => (
          <div key={key} className={`${(styleMap[key] ?? "bg-tint").split(" ")[0]}`} style={{ width: `${(n / total) * 100}%` }} title={`${titleCase(key)}: ${n}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, n]) => (
          <span key={key} className={`px-2 py-0.5 text-xs font-medium rounded-full ${styleMap[key] ?? "bg-tint text-caption"}`}>
            {titleCase(key)}: {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveAnalyticsClient({ initialData, initialDays }: { initialData: ExecutiveAnalyticsData | null; initialDays: number }) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);

  const changeWindow = async (next: number) => {
    setDays(next);
    setLoading(true);
    const result = await getExecutiveAnalyticsAction(next);
    setData(result);
    setLoading(false);
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Executive Analytics</h1>
        <p className="text-caption">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Executive Analytics</h1>
          <p className="text-caption">
            One rollup across traffic, leads, content, SEO health, AI usage/cost, and production — every number here is read from a feature already built
            elsewhere; this page adds no new data of its own.
          </p>
        </div>
        <div className="flex gap-1 bg-tint rounded-lg p-1 shrink-0">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={loading}
              onClick={() => changeWindow(opt)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                days === opt ? "bg-brand-orange-deep text-white" : "text-caption hover:text-foreground"
              }`}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      {/* Traffic / Leads / Conversion / Cost */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Organic Clicks (GSC)" value={data.organicTraffic.totalClicks.toLocaleString()} hint={`${data.organicTraffic.totalSessions.toLocaleString()} GA4 sessions`} />
        <StatCard label="Leads" value={data.leads.total.toLocaleString()} hint={`${data.leads.formSubmissions} forms · ${data.leads.bookings} bookings`} />
        <StatCard label="Organic Conversion Rate" value={formatPct(data.conversion.organicConversionRate)} hint="GA4 conversions ÷ organic sessions" />
        <StatCard label="AI Cost" value={formatUsd(data.aiCost.totalCost)} hint={data.aiCost.unknownCostJobCount > 0 ? `${data.aiCost.unknownCostJobCount} jobs unpriced` : "All recorded usage"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniBarChart title={`Organic clicks — last ${days}d`} points={data.organicTraffic.dailyClicks} color="bg-gradient-to-t from-brand-orange-deep to-brand-orange-light" />
        <MiniBarChart title={`Leads — last ${days}d`} points={data.leads.dailyLeads} color="bg-gradient-to-t from-blue-600 to-blue-400" />
      </div>

      {/* Top pages / keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Top pages</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-y border-border">
                <th className="px-6 py-2 font-medium text-caption">Page</th>
                <th className="px-6 py-2 font-medium text-caption">Clicks</th>
                <th className="px-6 py-2 font-medium text-caption">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topPages.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-caption">No traffic data imported yet.</td>
                </tr>
              ) : (
                data.topPages.map((p) => (
                  <tr key={p.path}>
                    <td className="px-6 py-3 text-foreground truncate max-w-xs" title={p.path}>{p.path}</td>
                    <td className="px-6 py-3 text-caption">{p.clicks.toLocaleString()}</td>
                    <td className="px-6 py-3 text-caption">{p.sessions.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Top keywords</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-y border-border">
                <th className="px-6 py-2 font-medium text-caption">Query</th>
                <th className="px-6 py-2 font-medium text-caption">Clicks</th>
                <th className="px-6 py-2 font-medium text-caption">Avg. position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topKeywords.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-6 text-center text-caption">No Search Console data imported yet.</td>
                </tr>
              ) : (
                data.topKeywords.map((k) => (
                  <tr key={k.query}>
                    <td className="px-6 py-3 text-foreground truncate max-w-xs" title={k.query}>{k.query}</td>
                    <td className="px-6 py-3 text-caption">{k.clicks.toLocaleString()}</td>
                    <td className="px-6 py-3 text-caption">{k.position.toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content performance / SEO health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Content performance</h2>
            <Link href="/admin/content-health" className="text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline">View detail →</Link>
          </div>
          <p className="text-xs text-caption">{data.contentPerformance.total} scored pages · avg score {data.contentPerformance.avgScore !== null ? data.contentPerformance.avgScore.toFixed(0) : "—"}</p>
          <DistributionBar counts={data.contentPerformance.byGrade} styleMap={GRADE_STYLE} />
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">SEO health</h2>
            <Link href="/admin/seo-audits" className="text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline">View detail →</Link>
          </div>
          {data.seoHealth ? (
            <>
              <p className="text-xs text-caption">
                {data.seoHealth.totalFindings} open findings · last audit {new Date(data.seoHealth.startedAt).toLocaleDateString()}
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.seoHealth.categoryCounts)
                  .filter(([, n]) => n > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, n]) => (
                    <span key={category} className="px-2 py-0.5 text-xs font-medium rounded-full bg-tint text-caption">
                      {category}: {n}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-caption">No audit has run yet.</p>
          )}
        </div>
      </div>

      {/* AI usage / Production volume / Refresh opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">AI usage</h2>
            <Link href="/admin/ai-pipeline/costs" className="text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline">Cost detail →</Link>
          </div>
          <p className="text-xs text-caption">{data.aiUsage.totalJobs} AI calls in this window</p>
          <DistributionBar
            counts={data.aiUsage.byStatus}
            styleMap={{ COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", PROCESSING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", QUEUED: "bg-tint text-caption" }}
          />
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Production volume</h2>
          <p className="text-xs text-caption">Published in this window</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.productionVolume.published).map(([type, n]) => (
              <span key={type} className="px-2 py-0.5 text-xs font-medium rounded-full bg-tint text-caption">
                {titleCase(type)}: {n}
              </span>
            ))}
          </div>
          <p className="text-xs text-caption">{data.productionVolume.pipelineRunsCompleted} completed via the AI Content Pipeline</p>
        </div>

        <div className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Refresh opportunities</h2>
            <Link href="/admin/content-refresh" className="text-xs text-brand-orange-deep dark:text-brand-orange-light hover:underline">View detail →</Link>
          </div>
          <p className="text-xs text-caption">{data.refreshOpportunities.detected} newly flagged, not yet actioned</p>
          <DistributionBar counts={data.refreshOpportunities.byStatus} styleMap={REFRESH_STATUS_STYLE} />
        </div>
      </div>

      {/* Market performance */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Market performance (Local SEO)</h2>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-background border-y border-border">
              <th className="px-6 py-2 font-medium text-caption">Market</th>
              <th className="px-6 py-2 font-medium text-caption">Locations</th>
              <th className="px-6 py-2 font-medium text-caption">Clicks</th>
              <th className="px-6 py-2 font-medium text-caption">Impressions</th>
              <th className="px-6 py-2 font-medium text-caption">Sessions</th>
              <th className="px-6 py-2 font-medium text-caption">Conversions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.marketPerformance.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-caption">No locations set up yet.</td>
              </tr>
            ) : (
              data.marketPerformance.map((m) => (
                <tr key={m.market}>
                  <td className="px-6 py-3 text-foreground font-medium">{MARKET_LABEL[m.market] ?? titleCase(m.market)}</td>
                  <td className="px-6 py-3 text-caption">{m.locationCount}</td>
                  <td className="px-6 py-3 text-caption">{m.clicks.toLocaleString()}</td>
                  <td className="px-6 py-3 text-caption">{m.impressions.toLocaleString()}</td>
                  <td className="px-6 py-3 text-caption">{m.sessions.toLocaleString()}</td>
                  <td className="px-6 py-3 text-caption">{m.conversions.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
