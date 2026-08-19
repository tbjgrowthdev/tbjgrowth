"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTrackedKeyword,
  deleteTrackedKeyword,
  runRankCheck,
  createCompetitorDomain,
  deleteCompetitorDomain,
} from "@/app/(admin)/actions/keywords";
import { Plus, AlertCircle, PlayCircle, Globe2 } from "lucide-react";
import DeleteButton from "./DeleteButton";
import RankSparkline from "./RankSparkline";

type RankCheck = { id: string; position: number | null; checkedAt: string | Date };
type TrackedKeyword = { id: string; term: string; targetUrl: string | null; rankChecks: RankCheck[] };
type CompetitorDomain = { id: string; domain: string; name: string | null; notes: string | null };

export default function KeywordTrackingManager({
  keywords,
  competitors,
}: {
  keywords: TrackedKeyword[];
  competitors: CompetitorDomain[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await createTrackedKeyword({ term, targetUrl: targetUrl || undefined });
    if (result.success) {
      setTerm("");
      setTargetUrl("");
      router.refresh();
    } else {
      setError(result.error || "Failed to add keyword");
    }
  };

  const handleRunCheck = async (id: string) => {
    setCheckingId(id);
    setCheckError(null);
    const result = await runRankCheck(id);
    if (!result.success) {
      setCheckError(result.error || "Rank check failed");
    }
    router.refresh();
    setCheckingId(null);
  };

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await createCompetitorDomain({ domain, name: competitorName || undefined });
    if (result.success) {
      setDomain("");
      setCompetitorName("");
      router.refresh();
    } else {
      setError(result.error || "Failed to add competitor");
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tracked Keywords</h2>
        <form
          onSubmit={handleAddKeyword}
          className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            type="text"
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Keyword phrase"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target page path (optional, e.g. /services)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Track
          </button>
        </form>

        {checkError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{checkError}</div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Keyword</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Target</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Rank History</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No keywords tracked yet. Add one above.
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{kw.term}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{kw.targetUrl || "—"}</td>
                    <td className="px-6 py-4">
                      <RankSparkline checks={kw.rankChecks} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleRunCheck(kw.id)}
                          disabled={checkingId === kw.id}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm disabled:opacity-50"
                        >
                          <PlayCircle size={16} />
                          {checkingId === kw.id ? "Checking..." : "Check Rank"}
                        </button>
                        <DeleteButton id={kw.id} onDelete={deleteTrackedKeyword} entityName="keyword" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Globe2 size={18} />
          Competitor Domains
        </h2>
        <form
          onSubmit={handleAddCompetitor}
          className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            type="text"
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="competitor-domain.co.uk"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={competitorName}
            onChange={(e) => setCompetitorName(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add
          </button>
        </form>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Domain</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {competitors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No competitor domains added yet.
                  </td>
                </tr>
              ) : (
                competitors.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white">{c.domain}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{c.name || "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <DeleteButton id={c.id} onDelete={deleteCompetitorDomain} entityName="competitor" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
