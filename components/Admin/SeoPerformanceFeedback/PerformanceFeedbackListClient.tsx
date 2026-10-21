"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X } from "lucide-react";
import {
  dismissPerformanceFeedbackAction,
  listPerformanceFeedbackAction,
  scanAndUpsertPerformanceFeedbackAction,
} from "@/app/(admin)/actions/seo-performance-feedback";
import { SIGNAL_LABEL, type PerformanceFeedbackSeverity, type PerformanceSignal } from "@/lib/seo-performance-feedback/types";

type Row = Awaited<ReturnType<typeof listPerformanceFeedbackAction>>[number];

const SEVERITY_STYLE: Record<PerformanceFeedbackSeverity, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-tint text-caption",
};

function parseSignals(json: string): PerformanceSignal[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function parseRecommendations(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function PageLink({ page, contentType }: { page: { title: string; slug: string } | null; contentType: string }) {
  if (!page) return <span className="text-caption">Deleted</span>;
  const href = contentType === "CASE_STUDY" ? "/admin/cases" : "/admin/posts";
  return (
    <Link href={href} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
      {page.title}
    </Link>
  );
}

export default function PerformanceFeedbackListClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ flagged: number; failed: number } | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertPerformanceFeedbackAction();
    setScanning(false);
    if (!result.success) {
      setError(result.error || "Scan failed");
      return;
    }
    setLastResult(result.data);
    router.refresh();
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    const result = await dismissPerformanceFeedbackAction(id);
    setBusyId(null);
    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">SEO Performance Feedback</h1>
          <p className="text-caption">
            Search Console, GA4, and CMS data, synthesized into one AI diagnosis and recommendation list per page. Detects ranking, CTR,
            traffic, and conversion decline, cannibalization, and content decay. Entirely advisory — nothing is changed automatically; act on
            a recommendation through Content Refresh or the Cannibalization manager, whichever signal is behind it.
          </p>
        </div>
        <button
          type="button"
          disabled={scanning}
          onClick={scan}
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 whitespace-nowrap"
        >
          {scanning ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Scan Now
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {lastResult !== null && !error && (
        <p className="text-sm text-caption">
          Scan complete — {lastResult.flagged} page(s) flagged{lastResult.failed > 0 ? `, ${lastResult.failed} AI call(s) failed (signals were still saved)` : ""}.
        </p>
      )}

      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="bg-card rounded-lg shadow-sm border border-border px-6 py-8 text-center text-caption">
            No open performance feedback. Run a scan to check for decline, decay, and cannibalization signals.
          </div>
        ) : (
          rows.map((r) => {
            const signals = parseSignals(r.signals);
            const recommendations = parseRecommendations(r.aiRecommendations);
            return (
              <div key={r.id} className="bg-card rounded-lg shadow-sm border border-border p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${SEVERITY_STYLE[r.severity]}`}>{r.severity}</span>
                      <span className="font-medium text-foreground">
                        <PageLink page={r.content} contentType={r.contentType} />
                      </span>
                      <span className="text-xs text-caption">{r.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {signals.map((s, i) => (
                        <span key={i} title={s.detail} className="px-2 py-0.5 text-xs rounded-full bg-tint text-caption">
                          {SIGNAL_LABEL[s.type]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => dismiss(r.id)}
                    title="Dismiss"
                    className="p-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50 shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>

                {r.aiSummary ? (
                  <>
                    <p className="text-sm text-foreground">{r.aiSummary}</p>
                    {recommendations.length > 0 && (
                      <ul className="list-disc list-inside space-y-1 text-sm text-caption">
                        {recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-caption italic">AI diagnosis unavailable for this run — signals above are still accurate.</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
