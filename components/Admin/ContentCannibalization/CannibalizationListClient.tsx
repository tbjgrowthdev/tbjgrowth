"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  dismissCannibalizationPairAction,
  listCannibalizationPairsAction,
  markCannibalizationResolvedAction,
  scanAndUpsertCannibalizationPairsAction,
} from "@/app/(admin)/actions/content-cannibalization";
import { ACTION_EXPLANATION, ACTION_LABEL, type CannibalizationActionType, type SharedQuery } from "@/lib/content-cannibalization/types";

type Pair = Awaited<ReturnType<typeof listCannibalizationPairsAction>>[number];

const ACTION_STYLE: Record<CannibalizationActionType, string> = {
  MERGE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  DIFFERENTIATE: "bg-tint text-caption",
  REDIRECT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  RETARGET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function parseSharedQueries(json: string): SharedQuery[] {
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

export default function CannibalizationListClient({ pairs }: { pairs: Pair[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFlagged, setLastFlagged] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertCannibalizationPairsAction();
    setScanning(false);
    if (!result.success) {
      setError(result.error || "Scan failed");
      return;
    }
    setLastFlagged(result.data.flagged);
    router.refresh();
  };

  const act = async (id: string, fn: (id: string) => Promise<{ success: boolean; error?: string }>) => {
    setBusyId(id);
    const result = await fn(id);
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
          <h1 className="text-2xl font-bold text-foreground">Content Cannibalization</h1>
          <p className="text-caption">
            Pairs of published pages competing for the same search intent. Every suggestion here is advisory — nothing is merged, redirected, or
            edited automatically; you decide what (if anything) to do, then mark it resolved.
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
      {lastFlagged !== null && !error && <p className="text-sm text-caption">Scan complete — {lastFlagged} pair(s) flagged.</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Page A</th>
              <th className="px-6 py-4 font-medium text-caption">Page B</th>
              <th className="px-6 py-4 font-medium text-caption">Similarity</th>
              <th className="px-6 py-4 font-medium text-caption">Shared queries</th>
              <th className="px-6 py-4 font-medium text-caption">Suggested action</th>
              <th className="px-6 py-4 font-medium text-caption"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pairs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No open cannibalization pairs. Run a scan to check for overlapping content.
                </td>
              </tr>
            ) : (
              pairs.map((p) => {
                const shared = parseSharedQueries(p.sharedQueries);
                return (
                  <tr key={p.id} className="hover:bg-background transition-colors align-top">
                    <td className="px-6 py-4 font-medium text-foreground max-w-[14rem]">
                      <PageLink page={p.pageA} contentType={p.contentTypeA} />
                      <div className="text-xs text-caption">{p.contentTypeA === "CASE_STUDY" ? "Case Study" : "Blog Post"}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground max-w-[14rem]">
                      <PageLink page={p.pageB} contentType={p.contentTypeB} />
                      <div className="text-xs text-caption">{p.contentTypeB === "CASE_STUDY" ? "Case Study" : "Blog Post"}</div>
                    </td>
                    <td className="px-6 py-4 text-caption">{p.similarity > 0 ? `${Math.round(p.similarity * 100)}%` : "—"}</td>
                    <td className="px-6 py-4 text-caption" title={shared.map((q) => `"${q.query}" (${q.impressionsA}/${q.impressionsB} impressions)`).join("\n")}>
                      {shared.length > 0 ? shared.length : "—"}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${ACTION_STYLE[p.suggestedAction]}`}>{ACTION_LABEL[p.suggestedAction]}</span>
                      <div className="text-xs text-caption mt-1">{ACTION_EXPLANATION[p.suggestedAction]}</div>
                      <div className="text-xs text-muted mt-1 italic">{p.reasoning}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => act(p.id, markCannibalizationResolvedAction)}
                          title="Mark resolved"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check size={14} />
                          Resolved
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => act(p.id, dismissCannibalizationPairAction)}
                          title="Dismiss"
                          className="p-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
