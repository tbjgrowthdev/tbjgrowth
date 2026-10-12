"use client";

import { useState } from "react";
import { runLinkCheckNow } from "@/app/(admin)/actions/link-monitor";
import { PlayCircle, AlertTriangle, CheckCircle2, Link2Off, Globe, RotateCw, Link2 } from "lucide-react";

type Finding = {
  category: "Internal 404" | "External Broken Link" | "Redirect Chain" | "Redirect Loop";
  path: string;
  status?: number | string;
  foundIn?: string[];
  description?: string;
};

type Run = {
  id: string;
  triggeredBy: string;
  startedAt: string | Date;
  completedAt: string | Date | null;
  internalChecked: number;
  internalBroken: number;
  externalChecked: number;
  externalBroken: number;
  redirectIssues: number;
  findings: string;
};

const CATEGORY_ICON = {
  "Internal 404": Link2Off,
  "External Broken Link": Globe,
  "Redirect Chain": Link2,
  "Redirect Loop": RotateCw,
};

export default function LinkMonitorClient({ latest, history }: { latest: Run | null; history: Run[] }) {
  const [currentRun, setCurrentRun] = useState(latest);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunNow = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await runLinkCheckNow();
      if (result.success && result.run) {
        setCurrentRun(result.run);
      } else {
        setError(result.error || "Scan failed");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const findings: Finding[] = currentRun ? JSON.parse(currentRun.findings) : [];
  const totalIssues = currentRun ? currentRun.internalBroken + currentRun.externalBroken + currentRun.redirectIssues : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-caption">
          Runs automatically overnight (3am) and can be triggered manually any time.
        </p>
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <PlayCircle size={18} />
          {isRunning ? "Scanning..." : "Run Now"}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>}

      {!currentRun ? (
        <div className="bg-card p-6 rounded-lg border border-border text-center text-caption">
          No scans have run yet. Click &ldquo;Run Now&rdquo; to check the site.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Internal Links" value={currentRun.internalChecked} broken={currentRun.internalBroken} />
            <StatCard label="External Links" value={currentRun.externalChecked} broken={currentRun.externalBroken} />
            <StatCard label="Redirect Issues" value={currentRun.redirectIssues} broken={currentRun.redirectIssues} isCount />
            <div className="bg-card p-4 rounded-lg border border-border">
              <p className="text-xs text-caption">Last run</p>
              <p className="text-sm font-medium text-foreground">{new Date(currentRun.startedAt).toLocaleString()}</p>
              <p className="text-xs text-caption">{currentRun.triggeredBy === "cron" ? "Scheduled" : "Manual"}</p>
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              {totalIssues === 0 ? (
                <>
                  <CheckCircle2 size={18} className="text-green-500" />
                  No issues found
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="text-amber-500" />
                  {totalIssues} issue{totalIssues > 1 ? "s" : ""} found
                </>
              )}
            </h2>

            {findings.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {findings.map((f, i) => {
                  const Icon = CATEGORY_ICON[f.category];
                  return (
                    <div key={i} className="flex items-start gap-2 text-sm border-b border-border pb-2 last:border-0">
                      <Icon size={14} className="mt-0.5 text-amber-500 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">{f.category}: </span>
                        <span className="font-mono text-xs text-caption">{f.path}</span>
                        {f.status && <span className="text-red-600 dark:text-red-400 text-xs ml-2">({f.status})</span>}
                        {f.description && <p className="text-xs text-caption mt-0.5">{f.description}</p>}
                        {f.foundIn && f.foundIn.length > 0 && (
                          <p className="text-xs text-caption mt-0.5">Found in: {f.foundIn.join(", ")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                <th className="px-6 py-3 font-medium text-caption">Internal Broken</th>
                <th className="px-6 py-3 font-medium text-caption">External Broken</th>
                <th className="px-6 py-3 font-medium text-caption">Redirect Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((run) => (
                <tr key={run.id}>
                  <td className="px-6 py-3 text-caption">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-caption">{run.triggeredBy}</td>
                  <td className="px-6 py-3 text-foreground">{run.internalBroken}</td>
                  <td className="px-6 py-3 text-foreground">{run.externalBroken}</td>
                  <td className="px-6 py-3 text-foreground">{run.redirectIssues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, broken, isCount }: { label: string; value: number; broken: number; isCount?: boolean }) {
  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <p className="text-xs text-caption">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {!isCount && (
        <p className={`text-xs ${broken > 0 ? "text-red-600 dark:text-red-400" : "text-caption"}`}>
          {broken} broken
        </p>
      )}
    </div>
  );
}
