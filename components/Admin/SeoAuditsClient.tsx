"use client";

import { useState } from "react";
import { triggerSeoAudit } from "@/app/(admin)/actions/seo-audits";
import { SEO_AUDIT_CATEGORIES, type SeoAuditCategory, type SeoAuditFinding } from "@/lib/seo-audits/types";
import { PlayCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

type Run = {
  id: string;
  triggeredBy: string;
  startedAt: string | Date;
  totalFindings: number;
  categoryCounts: Record<string, number>;
  findings: SeoAuditFinding[];
};

type HistoryRow = { id: string; triggeredBy: string; startedAt: string | Date; totalFindings: number };

export default function SeoAuditsClient({ latest, history }: { latest: Run | null; history: HistoryRow[] }) {
  const [currentRun, setCurrentRun] = useState(latest);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SeoAuditCategory | "All">("All");

  const handleRunNow = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await triggerSeoAudit();
      if (result.success && result.run) {
        setCurrentRun(result.run);
        setCategoryFilter("All");
      } else {
        setError(result.error || "Audit failed");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const findings = currentRun?.findings || [];
  const visibleFindings = categoryFilter === "All" ? findings : findings.filter((f) => f.category === categoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-caption">Runs automatically overnight and can be triggered manually any time.</p>
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <PlayCircle size={18} />
          {isRunning ? "Scanning..." : "Run Audit Now"}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>}

      {!currentRun ? (
        <div className="bg-card p-6 rounded-lg border border-border text-center text-caption">
          No audits have run yet. Click &ldquo;Run Audit Now&rdquo; to scan the site.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {SEO_AUDIT_CATEGORIES.map((category) => {
              const count = currentRun.categoryCounts[category] || 0;
              return (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`text-left bg-card p-3 rounded-lg border transition-colors ${
                    categoryFilter === category ? "border-brand-orange-deep" : "border-border hover:border-brand-orange-light"
                  }`}
                >
                  <p className="text-xs text-caption leading-tight">{category}</p>
                  <p className={`text-xl font-bold ${count > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{count}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-card p-6 rounded-lg border border-border space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                {currentRun.totalFindings === 0 ? (
                  <>
                    <CheckCircle2 size={18} className="text-green-500" />
                    No issues found
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} className="text-amber-500" />
                    {currentRun.totalFindings} issue{currentRun.totalFindings > 1 ? "s" : ""} found
                    {categoryFilter !== "All" && ` — showing ${visibleFindings.length} in "${categoryFilter}"`}
                  </>
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-caption">
                Last run: {new Date(currentRun.startedAt).toLocaleString()} ({currentRun.triggeredBy === "cron" ? "Scheduled" : "Manual"})
                {categoryFilter !== "All" && (
                  <button onClick={() => setCategoryFilter("All")} className="text-brand-orange-deep dark:text-brand-orange-light hover:underline">
                    Clear filter
                  </button>
                )}
              </div>
            </div>

            {visibleFindings.length > 0 && (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto">
                {visibleFindings.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm border-b border-border pb-2 last:border-0">
                    <AlertTriangle size={14} className="mt-0.5 text-amber-500 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{f.category}: </span>
                      {f.title && <span className="text-foreground">{f.title} </span>}
                      <span className="font-mono text-xs text-caption">{f.path}</span>
                      <p className="text-xs text-caption mt-0.5">{f.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {history.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Scan History</h3>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background">
                <th className="px-6 py-3 font-medium text-caption">When</th>
                <th className="px-6 py-3 font-medium text-caption">Triggered</th>
                <th className="px-6 py-3 font-medium text-caption">Total Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((run) => (
                <tr key={run.id}>
                  <td className="px-6 py-3 text-caption">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-caption">{run.triggeredBy}</td>
                  <td className="px-6 py-3 text-foreground">{run.totalFindings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
