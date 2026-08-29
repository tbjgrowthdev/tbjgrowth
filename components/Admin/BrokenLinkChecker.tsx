"use client";

import { useState } from "react";
import { checkBrokenLinks } from "@/app/(admin)/actions/seo-audit";
import { Link2Off, PlayCircle } from "lucide-react";

export default function BrokenLinkChecker() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ checked: number; broken: { path: string; status: number | "error" }[] } | null>(null);

  const runCheck = async () => {
    setIsRunning(true);
    const res = await checkBrokenLinks();
    setResult(res);
    setIsRunning(false);
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Link2Off size={18} />
          Broken Link Checker
        </h2>
        <button
          onClick={runCheck}
          disabled={isRunning}
          className="flex items-center gap-2 px-3 py-1.5 bg-brand-orange-deep text-white text-sm rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <PlayCircle size={16} />
          {isRunning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {!result && (
        <p className="text-sm text-caption">
          Scans internal links found inside published posts, pages, and case studies for broken (4xx/5xx) responses.
        </p>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-caption">
            Checked {result.checked} unique internal link{result.checked === 1 ? "" : "s"}.
          </p>
          {result.broken.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">No broken links found.</p>
          ) : (
            <ul className="divide-y divide-border">
              {result.broken.map((b) => (
                <li key={b.path} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-mono text-foreground">{b.path}</span>
                  <span className="text-red-600 dark:text-red-400 font-medium">{b.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
