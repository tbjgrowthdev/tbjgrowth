"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import {
  applyRefreshDraftAction,
  approveRefreshDraftAction,
  generateRefreshDraftAction,
  getJobsForRefreshAction,
  getRefreshDetailAction,
  rejectRefreshDraftAction,
} from "@/app/(admin)/actions/content-refresh";
import { SIGNAL_LABEL, type DetectedSignal } from "@/lib/content-refresh/types";
import { STAGE_LABEL } from "@/lib/content-pipeline/types";

type Detail = Awaited<ReturnType<typeof getRefreshDetailAction>>;
type Refresh = NonNullable<Detail>["refresh"];
type Content = NonNullable<Detail>["content"];
type Jobs = Awaited<ReturnType<typeof getJobsForRefreshAction>>;

function parseSignals(json: string): DetectedSignal[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function RefreshDetailClient({ refresh, content, jobs }: { refresh: Refresh; content: Content; jobs: Jobs }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signals = parseSignals(refresh.signals);

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (!result.success) {
      setError(result.error || "Something went wrong");
      return;
    }
    router.refresh();
  };

  const editorHref = content ? (refresh.contentType === "POST" ? `/admin/posts/${refresh.contentId}` : `/admin/cases/${refresh.contentId}`) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/content-refresh" className="text-sm text-caption hover:text-foreground">
            ← Content Refresh Engine
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{content?.title || refresh.contentId}</h1>
          <p className="text-caption">{refresh.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"} — status: {refresh.status}</p>
        </div>
        {editorHref && (
          <Link href={editorHref} target="_blank" className="flex items-center gap-1.5 text-sm text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light shrink-0">
            Open live content <ExternalLink size={14} />
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="bg-card rounded-lg shadow-sm border border-border p-5">
        <h2 className="font-semibold text-foreground mb-3">Why this was flagged</h2>
        <ul className="space-y-1.5 text-sm">
          {signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <span>
                <span className="text-foreground font-medium">{SIGNAL_LABEL[s.type]}</span>
                <span className="text-caption"> — {s.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {content && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Current live content</h2>
          <p className="text-sm font-medium text-foreground mb-2">{content.title}</p>
          <div
            className="prose prose-sm max-w-none text-sm text-caption max-h-48 overflow-y-auto scrollbar-thin border border-border rounded-md p-4"
            dangerouslySetInnerHTML={{ __html: content.content }}
          />
        </div>
      )}

      {refresh.draftContent && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Proposed revision — not yet live</h2>
          {refresh.changeSummary && <p className="text-sm text-caption mb-3 italic">{refresh.changeSummary}</p>}
          <p className="text-sm font-medium text-foreground mb-2">{refresh.draftTitle}</p>
          <div
            className="prose prose-sm max-w-none text-sm text-caption max-h-64 overflow-y-auto scrollbar-thin border border-border rounded-md p-4 mb-3"
            dangerouslySetInnerHTML={{ __html: refresh.draftContent }}
          />
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="text-xs text-caption">Meta title</dt>
              <dd className="text-foreground">{refresh.draftMetaTitle}</dd>
            </div>
            <div>
              <dt className="text-xs text-caption">Meta description</dt>
              <dd className="text-foreground">{refresh.draftMetaDescription}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(refresh.status === "DETECTED" || refresh.status === "DRAFTING" || refresh.status === "REJECTED") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => generateRefreshDraftAction(refresh.id))}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {refresh.status === "REJECTED" ? "Draft Again" : "Generate Draft"}
          </button>
        )}

        {refresh.status === "DRAFTED" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => approveRefreshDraftAction(refresh.id))}
              className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => rejectRefreshDraftAction(refresh.id))}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(() => generateRefreshDraftAction(refresh.id))}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm"
            >
              Regenerate
            </button>
          </>
        )}

        {refresh.status === "APPROVED" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => applyRefreshDraftAction(refresh.id))}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Apply to Live Content
          </button>
        )}

        {refresh.status === "APPLIED" && (
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3">
            <CheckCircle2 size={16} />
            Applied to the live content. {editorHref && <Link href={editorHref} className="underline">View it</Link>} — the pre-refresh version is
            preserved in that content&apos;s own version history.
          </div>
        )}
      </div>

      {jobs.length > 0 && (
        <details className="bg-card rounded-lg shadow-sm border border-border p-5">
          <summary className="font-semibold text-foreground cursor-pointer">Job Log ({jobs.length})</summary>
          <table className="w-full text-left border-collapse text-sm mt-3">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium text-caption">Stage</th>
                <th className="py-2 pr-3 font-medium text-caption">Model</th>
                <th className="py-2 pr-3 font-medium text-caption">Status</th>
                <th className="py-2 pr-3 font-medium text-caption">Tokens</th>
                <th className="py-2 pr-3 font-medium text-caption">Cost</th>
                <th className="py-2 pr-3 font-medium text-caption">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-2 pr-3 text-foreground">{STAGE_LABEL[job.stage]}</td>
                  <td className="py-2 pr-3 text-caption">{job.model}</td>
                  <td className="py-2 pr-3 text-caption">{job.status}</td>
                  <td className="py-2 pr-3 text-caption">{job.totalTokens?.toLocaleString() ?? "—"}</td>
                  <td className="py-2 pr-3 text-caption">{job.costUsd != null ? `$${job.costUsd.toFixed(job.costUsd < 1 ? 4 : 2)}` : "—"}</td>
                  <td className="py-2 pr-3 text-caption max-w-xs truncate" title={job.error || ""}>
                    {job.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
