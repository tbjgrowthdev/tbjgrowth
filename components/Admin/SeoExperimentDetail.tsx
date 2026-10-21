"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, RotateCcw, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import type { getSeoExperiment } from "@/app/(admin)/actions/seo-experiments";
import { launchSeoExperimentAction, revertSeoExperimentAction, evaluateSeoExperimentAction as evaluateAction, deleteSeoExperimentAction } from "@/app/(admin)/actions/seo-experiments";
import type { ExperimentResults } from "@/lib/seo-experiments/types";

type Experiment = NonNullable<Awaited<ReturnType<typeof getSeoExperiment>>>;
type WindowInfo = { isWindowComplete: boolean; daysElapsed: number; daysRemaining: number };

const VARIABLE_LABEL: Record<string, string> = {
  TITLE: "Title",
  META_DESCRIPTION: "Meta Description",
  CTA: "CTA",
  INTERNAL_LINKS: "Internal Links",
  CONTENT_SECTION: "Content Section",
};

const IS_RICH_TEXT: Record<string, boolean> = {
  TITLE: false,
  META_DESCRIPTION: false,
  CTA: true,
  INTERNAL_LINKS: true,
  CONTENT_SECTION: true,
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  RUNNING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REVERTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ValueBlock({ richText, value }: { richText: boolean; value: string }) {
  if (!value) return <p className="text-sm text-caption italic">(empty)</p>;
  if (richText) {
    return <div className="text-sm text-foreground max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <p className="text-sm text-foreground">{value}</p>;
}

export default function SeoExperimentDetail({ experiment }: { experiment: Experiment }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(experiment.results);
  const [windowInfo, setWindowInfo] = useState<WindowInfo | null>(null);

  const richText = IS_RICH_TEXT[experiment.variable];

  const handleLaunch = async () => {
    setBusy(true);
    setError(null);
    const result = await launchSeoExperimentAction(experiment.id);
    setBusy(false);
    if (result.success) router.refresh();
    else setError(result.error);
  };

  const handleRevert = async () => {
    if (!confirm("Revert to the before value? The experiment will stop tracking.")) return;
    setBusy(true);
    setError(null);
    const result = await revertSeoExperimentAction(experiment.id);
    setBusy(false);
    if (result.success) router.refresh();
    else setError(result.error);
  };

  const handleEvaluate = async () => {
    setBusy(true);
    setError(null);
    const result = await evaluateAction(experiment.id);
    setBusy(false);
    if (result.success) {
      setResults(result.data.results);
      setWindowInfo(result.data);
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this experiment? This can't be undone.")) return;
    setBusy(true);
    const result = await deleteSeoExperimentAction(experiment.id);
    setBusy(false);
    if (result.success) router.push("/admin/seo-experiments");
    else setError(result.error);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLE[experiment.status]}`}>{experiment.status}</span>
          <span className="text-sm text-caption">{VARIABLE_LABEL[experiment.variable]} test</span>
        </div>
        <div>
          <span className="text-sm text-muted">Content: </span>
          {experiment.content ? (
            <span className="text-sm font-medium text-foreground">
              {experiment.content.title} {experiment.content.path && <span className="text-caption">({experiment.content.path})</span>}
            </span>
          ) : (
            <span className="text-sm text-caption">(deleted)</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-muted mb-1">Before</h3>
            <div className="border border-border rounded-lg p-3 bg-background">
              <ValueBlock richText={richText} value={experiment.beforeValue} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-muted mb-1">{experiment.status === "DRAFT" ? "After (will apply on launch)" : "After"}</h3>
            <div className="border border-border rounded-lg p-3 bg-background">
              <ValueBlock richText={richText} value={experiment.afterValue} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          {experiment.status === "DRAFT" && (
            <button type="button" disabled={busy} onClick={handleLaunch} className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
              <Rocket size={16} />
              Launch
            </button>
          )}
          {experiment.status === "RUNNING" && (
            <>
              <button type="button" disabled={busy} onClick={handleEvaluate} className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
                <RefreshCw size={16} />
                Check Results
              </button>
              <button type="button" disabled={busy} onClick={handleRevert} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50">
                <RotateCcw size={16} />
                Revert
              </button>
            </>
          )}
          {(experiment.status === "COMPLETED" || experiment.status === "REVERTED") && (
            <button type="button" disabled={busy} onClick={handleEvaluate} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50">
              <RefreshCw size={16} />
              Refresh Results
            </button>
          )}
          <button type="button" disabled={busy} onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50 ml-auto">
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {results && (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Results</h2>
            {windowInfo && !windowInfo.isWindowComplete && (
              <p className="text-sm text-caption">
                Evaluation window in progress — {windowInfo.daysElapsed} day(s) elapsed, {windowInfo.daysRemaining} remaining.
              </p>
            )}
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-3 font-medium text-caption">Metric</th>
                <th className="px-6 py-3 font-medium text-caption">Before ({results.before.days}d)</th>
                <th className="px-6 py-3 font-medium text-caption">After ({results.after.days}d)</th>
                <th className="px-6 py-3 font-medium text-caption">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-6 py-3 text-foreground">Clicks</td>
                <td className="px-6 py-3 text-caption">{results.before.clicks}</td>
                <td className="px-6 py-3 text-caption">{results.after.clicks}</td>
                <td className="px-6 py-3 text-caption">{formatPct(results.deltas.clicksPct)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-foreground">Impressions</td>
                <td className="px-6 py-3 text-caption">{results.before.impressions}</td>
                <td className="px-6 py-3 text-caption">{results.after.impressions}</td>
                <td className="px-6 py-3 text-caption">{formatPct(results.deltas.impressionsPct)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-foreground">CTR</td>
                <td className="px-6 py-3 text-caption">{(results.before.ctr * 100).toFixed(2)}%</td>
                <td className="px-6 py-3 text-caption">{(results.after.ctr * 100).toFixed(2)}%</td>
                <td className="px-6 py-3 text-caption">{formatPct(results.deltas.ctrPct)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-foreground">Avg. Position</td>
                <td className="px-6 py-3 text-caption">{results.before.position?.toFixed(1) ?? "—"}</td>
                <td className="px-6 py-3 text-caption">{results.after.position?.toFixed(1) ?? "—"}</td>
                <td className="px-6 py-3 text-caption">{results.deltas.positionChange != null ? results.deltas.positionChange.toFixed(1) : "—"}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-foreground">Sessions</td>
                <td className="px-6 py-3 text-caption">{results.before.sessions}</td>
                <td className="px-6 py-3 text-caption">{results.after.sessions}</td>
                <td className="px-6 py-3 text-caption">{formatPct(results.deltas.sessionsPct)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-foreground">Conversions</td>
                <td className="px-6 py-3 text-caption">{results.before.conversions}</td>
                <td className="px-6 py-3 text-caption">{results.after.conversions}</td>
                <td className="px-6 py-3 text-caption">{formatPct(results.deltas.conversionsPct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
