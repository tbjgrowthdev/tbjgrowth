"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import {
  dismissOrphanPageAction,
  listOrphanPagesAction,
  markOrphanPageResolvedAction,
  scanAndUpsertOrphanPagesAction,
} from "@/app/(admin)/actions/orphan-pages";

type Row = Awaited<ReturnType<typeof listOrphanPagesAction>>[number];

const STRENGTH_STYLE: Record<string, string> = {
  orphan: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  weak: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function PageLink({ page, contentType }: { page: { title: string; slug: string } | null; contentType: string }) {
  if (!page) return <span className="text-caption">Deleted</span>;
  const href = contentType === "CASE_STUDY" ? "/admin/cases" : "/admin/posts";
  return (
    <Link href={href} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
      {page.title}
    </Link>
  );
}

export default function OrphanPagesListClient({ pages }: { pages: Row[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFlagged, setLastFlagged] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertOrphanPagesAction();
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
          <h1 className="text-2xl font-bold text-foreground">Orphan Page Detection</h1>
          <p className="text-caption">
            Published blog posts and case studies with no (or only one) inbound internal link, plus suggested pages to link from. Every
            suggestion is advisory — nothing is edited automatically; add the link yourself, then mark it resolved.
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
      {lastFlagged !== null && !error && <p className="text-sm text-caption">Scan complete — {lastFlagged} page(s) flagged.</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Page</th>
              <th className="px-6 py-4 font-medium text-caption">Links In</th>
              <th className="px-6 py-4 font-medium text-caption">Suggested Links</th>
              <th className="px-6 py-4 font-medium text-caption"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No open orphan/weakly-linked pages. Run a scan to check internal linking.
                </td>
              </tr>
            ) : (
              pages.map((p) => (
                <tr key={p.id} className="hover:bg-background transition-colors align-top">
                  <td className="px-6 py-4 font-medium text-foreground max-w-[14rem]">
                    <PageLink page={p.page} contentType={p.contentType} />
                    <div className="text-xs text-caption">{p.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STRENGTH_STYLE[p.inboundLinkCount === 0 ? "orphan" : "weak"]}`}>
                      {p.inboundLinkCount} link{p.inboundLinkCount === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-md">
                    {p.suggestions.length === 0 ? (
                      <span className="text-xs text-caption">No similar published content found to suggest a source from.</span>
                    ) : (
                      <ul className="space-y-2">
                        {p.suggestions.map((s, i) => (
                          <li key={i} className="text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                            <div>
                              <span className="text-caption">Source: </span>
                              <Link
                                href={s.sourceContentType === "CASE_STUDY" ? "/admin/cases" : "/admin/posts"}
                                className="font-medium text-foreground hover:text-brand-orange-deep dark:hover:text-brand-orange-light"
                              >
                                {s.sourceTitle}
                              </Link>
                              <span className="text-caption"> ({Math.round(s.similarity * 100)}% similar)</span>
                            </div>
                            <div className="text-caption">
                              Anchor: <span className="italic text-foreground">&ldquo;{s.anchor}&rdquo;</span>
                            </div>
                            <div className="text-caption mt-0.5">Context: &ldquo;{s.context}&rdquo;</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => act(p.id, markOrphanPageResolvedAction)}
                        title="Mark resolved"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50 whitespace-nowrap"
                      >
                        <Check size={14} />
                        Resolved
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => act(p.id, dismissOrphanPageAction)}
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
