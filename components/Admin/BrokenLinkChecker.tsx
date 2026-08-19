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
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Link2Off size={18} />
          Broken Link Checker
        </h2>
        <button
          onClick={runCheck}
          disabled={isRunning}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <PlayCircle size={16} />
          {isRunning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {!result && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Scans internal links found inside published posts, pages, and case studies for broken (4xx/5xx) responses.
        </p>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Checked {result.checked} unique internal link{result.checked === 1 ? "" : "s"}.
          </p>
          {result.broken.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">No broken links found.</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {result.broken.map((b) => (
                <li key={b.path} className="py-2 flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-900 dark:text-white">{b.path}</span>
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
