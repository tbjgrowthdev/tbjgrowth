"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { listRefreshCandidatesAction, scanAndUpsertCandidatesAction } from "@/app/(admin)/actions/content-refresh";
import { SIGNAL_LABEL, type DetectedSignal } from "@/lib/content-refresh/types";

type Candidate = Awaited<ReturnType<typeof listRefreshCandidatesAction>>[number];

const STATUS_STYLE: Record<string, string> = {
  DETECTED: "bg-tint text-caption",
  DRAFTING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DRAFTED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-brand-orange-deep/10 text-brand-orange-deep dark:text-brand-orange-light",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  APPLIED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function parseSignals(json: string): DetectedSignal[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function RefreshListClient({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFlagged, setLastFlagged] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertCandidatesAction();
    setScanning(false);
    if (!result.success) {
      setError(result.error || "Scan failed");
      return;
    }
    setLastFlagged(result.data.flagged);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Refresh Engine</h1>
          <p className="text-caption">
            Detects published content that&apos;s aging, outdated, or declining in rankings/traffic/CTR. The AI only ever proposes a revision — nothing is
            overwritten until a human approves and applies it.
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
      {lastFlagged !== null && !error && <p className="text-sm text-caption">Scan complete — {lastFlagged} item(s) flagged.</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Content</th>
              <th className="px-6 py-4 font-medium text-caption">Signals</th>
              <th className="px-6 py-4 font-medium text-caption">Status</th>
              <th className="px-6 py-4 font-medium text-caption">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {candidates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No refresh candidates yet. Run a scan to detect aging or declining content.
                </td>
              </tr>
            ) : (
              candidates.map((c) => {
                const signals = parseSignals(c.signals);
                return (
                  <tr key={c.id} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/admin/content-refresh/${c.id}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                        {c.content?.title || c.contentId}
                      </Link>
                      <div className="text-xs text-caption">{c.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {signals.map((s, i) => (
                          <span key={i} title={s.detail} className="text-xs px-2 py-0.5 rounded-full bg-tint text-caption">
                            {SIGNAL_LABEL[s.type]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-caption">{new Date(c.updatedAt).toLocaleDateString()}</td>
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
