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
        <h2 className="text-lg font-semibold text-foreground mb-3">Tracked Keywords</h2>
        <form
          onSubmit={handleAddKeyword}
          className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            type="text"
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Keyword phrase"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target page path (optional, e.g. /services)"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
          >
            <Plus size={18} />
            Track
          </button>
        </form>

        {checkError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{checkError}</div>
        )}

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 font-medium text-caption">Keyword</th>
                <th className="px-6 py-4 font-medium text-caption">Target</th>
                <th className="px-6 py-4 font-medium text-caption">Rank History</th>
                <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-caption">
                    No keywords tracked yet. Add one above.
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr key={kw.id} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{kw.term}</td>
                    <td className="px-6 py-4 text-caption text-sm">{kw.targetUrl || "—"}</td>
                    <td className="px-6 py-4">
                      <RankSparkline checks={kw.rankChecks} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleRunCheck(kw.id)}
                          disabled={checkingId === kw.id}
                          className="flex items-center gap-1.5 text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange text-sm disabled:opacity-50"
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
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe2 size={18} />
          Competitor Domains
        </h2>
        <form
          onSubmit={handleAddCompetitor}
          className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row gap-3 mb-4"
        >
          <input
            type="text"
            required
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="competitor-domain.co.uk"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
          <input
            type="text"
            value={competitorName}
            onChange={(e) => setCompetitorName(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
          >
            <Plus size={18} />
            Add
          </button>
        </form>

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 font-medium text-caption">Domain</th>
                <th className="px-6 py-4 font-medium text-caption">Name</th>
                <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {competitors.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-caption">
                    No competitor domains added yet.
                  </td>
                </tr>
              ) : (
                competitors.map((c) => (
                  <tr key={c.id} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-foreground">{c.domain}</td>
                    <td className="px-6 py-4 text-caption">{c.name || "—"}</td>
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
