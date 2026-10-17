"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { listHealthScoresAction, scanAndUpsertHealthScoresAction } from "@/app/(admin)/actions/content-health";
import { FACTOR_LABEL, GRADE_LABEL, type FactorScore } from "@/lib/content-health/types";

type Score = Awaited<ReturnType<typeof listHealthScoresAction>>[number];

const GRADE_STYLE: Record<string, string> = {
  EXCELLENT: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  GOOD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  NEEDS_ATTENTION: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  POOR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function parseFactors(json: string): FactorScore[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function ContentHealthListClient({ scores }: { scores: Score[] }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScored, setLastScored] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError(null);
    const result = await scanAndUpsertHealthScoresAction();
    setScanning(false);
    if (!result.success) {
      setError(result.error || "Scan failed");
      return;
    }
    setLastScored(result.data.scored);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Health Score</h1>
          <p className="text-caption">
            Every published post and case study scored across 8 factors — freshness, traffic, ranking, CTR, internal links, SEO completeness,
            search intent, and conversion. A factor with no data for a page (nothing connected, nothing tracked) is left out of its score rather
            than counted as zero. Sorted worst-first.
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
      {lastScored !== null && !error && <p className="text-sm text-caption">Scan complete — {lastScored} item(s) scored.</p>}

      <div className="bg-card rounded-lg shadow-sm border border-border divide-y divide-border overflow-hidden">
        {scores.length === 0 ? (
          <p className="px-6 py-8 text-center text-caption">No health scores yet. Run a scan to compute them.</p>
        ) : (
          scores.map((s) => {
            const factors = parseFactors(s.factors);
            return (
              <details key={s.id} className="group">
                <summary className="cursor-pointer list-none flex items-center gap-4 px-6 py-4 hover:bg-background transition-colors">
                  <span className="flex-1 font-medium text-foreground">
                    {s.content?.title}
                    <span className="block text-xs text-caption font-normal">{s.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</span>
                  </span>
                  <span className="font-mono text-sm w-10 text-right">{s.overallScore}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${GRADE_STYLE[s.grade]}`}>{GRADE_LABEL[s.grade as keyof typeof GRADE_LABEL]}</span>
                  <span className="text-xs text-caption whitespace-nowrap hidden sm:inline">{new Date(s.computedAt).toLocaleDateString()}</span>
                </summary>
                <table className="w-full text-left border-collapse text-sm px-6 pb-4">
                  <tbody className="divide-y divide-border">
                    {factors.map((f) => (
                      <tr key={f.factor}>
                        <td className="py-1.5 pl-6 pr-4 text-caption w-40 whitespace-nowrap">{FACTOR_LABEL[f.factor]}</td>
                        <td className="py-1.5 pr-4 font-mono w-12">{f.score === null ? "—" : f.score}</td>
                        <td className="py-1.5 pr-6 text-caption">{f.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
