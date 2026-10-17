"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import {
  dismissRecommendationAction,
  listRecommendationsAction,
  markRecommendationInProgressAction,
  scanAndUpsertRecommendationsAction,
} from "@/app/(admin)/actions/content-recommendations";

type Recommendation = Awaited<ReturnType<typeof listRecommendationsAction>>[number];

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-tint text-caption",
};

export default function RecommendationsListClient({ recommendations }: { recommendations: Recommendation[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFlagged, setLastFlagged] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertRecommendationsAction();
    setScanning(false);
    if (!result.success) {
      setError(result.error || "Scan failed");
      return;
    }
    setLastFlagged(result.data.flagged);
    router.refresh();
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    const result = await dismissRecommendationAction(id);
    setBusyId(null);
    if (!result.success) {
      setError(result.error || "Failed to dismiss");
      return;
    }
    router.refresh();
  };

  const createContent = async (rec: Recommendation) => {
    setBusyId(rec.id);
    await markRecommendationInProgressAction(rec.id);
    setBusyId(null);
    const params = new URLSearchParams({ topic: rec.topic, contentType: rec.contentType, keyword: rec.keyword, format: rec.suggestedFormat });
    router.push(`/admin/ai-pipeline/new?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Recommendations</h1>
          <p className="text-caption">
            Keyword gaps found by comparing real search demand (Search Console, Rank Tracker) against what&apos;s already published — each one is a
            topic suggestion, not a draft.
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
      {lastFlagged !== null && !error && <p className="text-sm text-caption">Scan complete — {lastFlagged} opportunity(ies) found.</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Topic</th>
              <th className="px-6 py-4 font-medium text-caption">Priority</th>
              <th className="px-6 py-4 font-medium text-caption">Format</th>
              <th className="px-6 py-4 font-medium text-caption">Keyword</th>
              <th className="px-6 py-4 font-medium text-caption">Suggested timing</th>
              <th className="px-6 py-4 font-medium text-caption"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {recommendations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No open recommendations. Run a scan to find keyword gaps.
                </td>
              </tr>
            ) : (
              recommendations.map((rec) => (
                <tr key={rec.id} className="hover:bg-background transition-colors align-top">
                  <td className="px-6 py-4 font-medium text-foreground max-w-xs">
                    {rec.topic}
                    <div className="text-xs text-caption mt-1 font-normal" title={rec.reasoning}>
                      {rec.reasoning.length > 90 ? `${rec.reasoning.slice(0, 90)}…` : rec.reasoning}
                    </div>
                    {rec.status === "IN_PROGRESS" && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">In progress</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${PRIORITY_STYLE[rec.priority]}`}>{rec.priority}</span>
                  </td>
                  <td className="px-6 py-4 text-caption">{rec.suggestedFormat}</td>
                  <td className="px-6 py-4 text-caption">
                    {rec.keyword}
                    <div className="text-xs text-muted">{rec.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</div>
                  </td>
                  <td className="px-6 py-4 text-caption">{new Date(rec.suggestedPublishAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={busyId === rec.id}
                        onClick={() => createContent(rec)}
                        title="Create content"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50 whitespace-nowrap"
                      >
                        <Sparkles size={14} />
                        Create Content
                      </button>
                      <button
                        type="button"
                        disabled={busyId === rec.id}
                        onClick={() => dismiss(rec.id)}
                        title="Dismiss"
                        className="p-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                    </div>
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
