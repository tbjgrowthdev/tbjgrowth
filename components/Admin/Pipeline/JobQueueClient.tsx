"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { retryJobAction, getAllJobsAction } from "@/app/(admin)/actions/content-pipeline";
import { STAGE_LABEL } from "@/lib/content-pipeline/types";

type Job = Awaited<ReturnType<typeof getAllJobsAction>>[number];

const STATUS_STYLE: Record<string, string> = {
  QUEUED: "bg-tint text-caption",
  PROCESSING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function JobQueueClient({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const retry = async (job: Job) => {
    if (!job.pipelineRunId) return; // Content Refresh jobs: regenerate from the refresh's own detail page instead.
    setRetrying(job.id);
    setError(null);
    const result = await retryJobAction(job.pipelineRunId, job.stage);
    setRetrying(null);
    if (!result.success) {
      setError(result.error || "Retry failed");
      return;
    }
    router.refresh();
  };

  const linkFor = (job: Job) => (job.pipelineRunId ? `/admin/ai-pipeline/${job.pipelineRunId}` : job.contentRefreshId ? `/admin/content-refresh/${job.contentRefreshId}` : null);

  const topicFor = (job: Job) => {
    if (job.pipelineRun) {
      try {
        return JSON.parse(job.pipelineRun.brief)?.topic || job.pipelineRunId;
      } catch {
        return job.pipelineRunId;
      }
    }
    if (job.contentRefresh) return job.contentRefresh.draftTitle || "Content refresh";
    return job.id;
  };

  const duration = (job: Job) => {
    if (!job.startedAt) return "—";
    const end = job.completedAt ?? new Date();
    const ms = new Date(end).getTime() - new Date(job.startedAt).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const cost = (job: Job) => (job.costUsd != null ? `$${job.costUsd.toFixed(job.costUsd < 1 ? 4 : 2)}` : job.totalTokens != null ? "unpriced" : "—");

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-4 py-3 font-medium text-caption">Job</th>
              <th className="px-4 py-3 font-medium text-caption">Run</th>
              <th className="px-4 py-3 font-medium text-caption">Stage</th>
              <th className="px-4 py-3 font-medium text-caption">Provider / Model</th>
              <th className="px-4 py-3 font-medium text-caption">Status</th>
              <th className="px-4 py-3 font-medium text-caption">Retries</th>
              <th className="px-4 py-3 font-medium text-caption">Duration</th>
              <th className="px-4 py-3 font-medium text-caption">Tokens</th>
              <th className="px-4 py-3 font-medium text-caption">Cost</th>
              <th className="px-4 py-3 font-medium text-caption">Error</th>
              <th className="px-4 py-3 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-caption">
                  No AI jobs yet.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-background transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-caption">{job.id.slice(0, 10)}…</td>
                  <td className="px-4 py-3 text-foreground">
                    {linkFor(job) ? (
                      <Link href={linkFor(job)!} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                        {topicFor(job)}
                      </Link>
                    ) : (
                      topicFor(job)
                    )}
                  </td>
                  <td className="px-4 py-3 text-caption">{STAGE_LABEL[job.stage]}</td>
                  <td className="px-4 py-3 text-caption">
                    {job.provider} / {job.model}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLE[job.status]}`}>{job.status}</span>
                  </td>
                  <td className="px-4 py-3 text-caption">{job.retryCount}</td>
                  <td className="px-4 py-3 text-caption">{duration(job)}</td>
                  <td className="px-4 py-3 text-caption">{job.totalTokens?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3 text-caption">{cost(job)}</td>
                  <td className="px-4 py-3 text-caption max-w-xs truncate" title={job.error || ""}>
                    {job.error || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {job.status === "FAILED" && job.pipelineRunId && (
                      <button
                        type="button"
                        disabled={retrying === job.id}
                        onClick={() => retry(job)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50 ml-auto"
                      >
                        {retrying === job.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Retry
                      </button>
                    )}
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
