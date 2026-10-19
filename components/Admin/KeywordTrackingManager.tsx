"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createTrackedKeyword,
  updateTrackedKeyword,
  deleteTrackedKeyword,
  runRankCheck,
  refreshKeywordMetrics,
  createCompetitorDomain,
  deleteCompetitorDomain,
} from "@/app/(admin)/actions/keywords";
import { Plus, AlertCircle, AlertTriangle, PlayCircle, Globe2, Pencil, RefreshCw, Check, X } from "lucide-react";
import DeleteButton from "./DeleteButton";
import RankSparkline from "./RankSparkline";

type SearchIntent = "INFORMATIONAL" | "NAVIGATIONAL" | "COMMERCIAL" | "TRANSACTIONAL";
type KeywordStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

type RankCheck = { id: string; position: number | null; checkedAt: string | Date };
type TrackedKeyword = {
  id: string;
  term: string;
  searchIntent: SearchIntent;
  targetUrl: string | null;
  country: string;
  language: string;
  searchVolume: number | null;
  difficulty: number | null;
  status: KeywordStatus;
  rankChecks: RankCheck[];
};
type CompetitorDomain = { id: string; domain: string; name: string | null; notes: string | null };
type IntentConflict = { term: string; searchIntent: string; targetUrls: string[]; keywordIds: string[] };

const COUNTRIES = [
  { code: "GB", label: "UK" },
  { code: "BD", label: "Bangladesh" },
  { code: "AE", label: "Gulf (UAE)" },
];
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bengali" },
  { code: "ar", label: "Arabic" },
];
const INTENTS: SearchIntent[] = ["INFORMATIONAL", "NAVIGATIONAL", "COMMERCIAL", "TRANSACTIONAL"];
const STATUSES: KeywordStatus[] = ["ACTIVE", "PAUSED", "ARCHIVED"];

const INTENT_BADGE: Record<SearchIntent, string> = {
  INFORMATIONAL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  NAVIGATIONAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  COMMERCIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  TRANSACTIONAL: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};
const STATUS_BADGE: Record<KeywordStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  ARCHIVED: "bg-tint text-caption",
};

function intentLabel(value: SearchIntent | KeywordStatus): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

type EditState = { targetUrl: string; searchIntent: SearchIntent; country: string; language: string; status: KeywordStatus };

export default function KeywordTrackingManager({
  keywords,
  competitors,
  conflicts = [],
}: {
  keywords: TrackedKeyword[];
  competitors: CompetitorDomain[];
  conflicts?: IntentConflict[];
}) {
  const router = useRouter();
  const conflictedKeywordIds = new Set(conflicts.flatMap((c) => c.keywordIds));
  const [term, setTerm] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [searchIntent, setSearchIntent] = useState<SearchIntent>("INFORMATIONAL");
  const [country, setCountry] = useState("GB");
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [domain, setDomain] = useState("");
  const [competitorName, setCompetitorName] = useState("");

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await createTrackedKeyword({
      term,
      targetUrl: targetUrl || undefined,
      searchIntent,
      country,
      language,
    });
    if (result.success) {
      setTerm("");
      setTargetUrl("");
      setSearchIntent("INFORMATIONAL");
      setCountry("GB");
      setLanguage("en");
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

  const handleRefreshMetrics = async (id: string) => {
    setRefreshingId(id);
    setCheckError(null);
    const result = await refreshKeywordMetrics(id);
    if (!result.success) {
      setCheckError(result.error || "Metrics refresh failed");
    }
    router.refresh();
    setRefreshingId(null);
  };

  const startEdit = (kw: TrackedKeyword) => {
    setEditingId(kw.id);
    setEditState({
      targetUrl: kw.targetUrl || "",
      searchIntent: kw.searchIntent,
      country: kw.country,
      language: kw.language,
      status: kw.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdit = async (id: string) => {
    if (!editState) return;
    setSavingEdit(true);
    const result = await updateTrackedKeyword(id, editState);
    setSavingEdit(false);
    if (result.success) {
      setEditingId(null);
      setEditState(null);
      router.refresh();
    } else {
      setCheckError(result.error || "Failed to update keyword");
    }
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

        {conflicts.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 font-semibold text-sm mb-2">
              <AlertTriangle size={16} />
              {conflicts.length} keyword{conflicts.length > 1 ? "s" : ""} mapped to multiple URLs with the same intent
            </div>
            <ul className="space-y-1 text-sm">
              {conflicts.map((c) => (
                <li key={`${c.term}::${c.searchIntent}`}>
                  <strong>&quot;{c.term}&quot;</strong> ({intentLabel(c.searchIntent as SearchIntent)}) targets {c.targetUrls.length} different URLs:{" "}
                  {c.targetUrls.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          onSubmit={handleAddKeyword}
          className="bg-card p-4 rounded-lg shadow-sm border border-border flex flex-col sm:flex-row flex-wrap gap-3 mb-4"
        >
          <input
            type="text"
            required
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Keyword phrase"
            className="flex-1 min-w-[160px] px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL (optional, e.g. /services)"
            className="flex-1 min-w-[160px] px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
          <select
            value={searchIntent}
            onChange={(e) => setSearchIntent(e.target.value as SearchIntent)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            {INTENTS.map((intent) => (
              <option key={intent} value={intent}>
                {intentLabel(intent)}
              </option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
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

        <div className="bg-card rounded-lg shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-6 py-4 font-medium text-caption">Keyword</th>
                <th className="px-6 py-4 font-medium text-caption">Intent</th>
                <th className="px-6 py-4 font-medium text-caption">Market</th>
                <th className="px-6 py-4 font-medium text-caption">Target URL</th>
                <th className="px-6 py-4 font-medium text-caption">Volume / Difficulty</th>
                <th className="px-6 py-4 font-medium text-caption">Current Rank</th>
                <th className="px-6 py-4 font-medium text-caption">Status</th>
                <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-caption">
                    No keywords tracked yet. Add one above.
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => {
                  const isEditing = editingId === kw.id && editState;
                  return (
                    <tr key={kw.id} className="hover:bg-background transition-colors align-top">
                      <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {kw.term}
                          {conflictedKeywordIds.has(kw.id) && (
                            <span title="Multiple URLs target this keyword with the same intent">
                              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select
                            value={editState!.searchIntent}
                            onChange={(e) => setEditState({ ...editState!, searchIntent: e.target.value as SearchIntent })}
                            className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm"
                          >
                            {INTENTS.map((intent) => (
                              <option key={intent} value={intent}>
                                {intentLabel(intent)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${INTENT_BADGE[kw.searchIntent]}`}>
                            {intentLabel(kw.searchIntent)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-caption text-sm whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-1.5">
                            <select
                              value={editState!.country}
                              onChange={(e) => setEditState({ ...editState!, country: e.target.value })}
                              className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm"
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editState!.language}
                              onChange={(e) => setEditState({ ...editState!, language: e.target.value })}
                              className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm"
                            >
                              {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>
                                  {l.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <>
                            {COUNTRIES.find((c) => c.code === kw.country)?.label || kw.country} ·{" "}
                            {LANGUAGES.find((l) => l.code === kw.language)?.label || kw.language}
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-caption text-sm">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editState!.targetUrl}
                            onChange={(e) => setEditState({ ...editState!, targetUrl: e.target.value })}
                            placeholder="/services"
                            className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm w-full min-w-[140px]"
                          />
                        ) : (
                          kw.targetUrl || "—"
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">
                        {kw.searchVolume !== null ? kw.searchVolume.toLocaleString() : "—"} /{" "}
                        {kw.difficulty !== null ? kw.difficulty : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <RankSparkline checks={kw.rankChecks} />
                      </td>
                      <td className="px-6 py-4">
                        {isEditing ? (
                          <select
                            value={editState!.status}
                            onChange={(e) => setEditState({ ...editState!, status: e.target.value as KeywordStatus })}
                            className="px-2 py-1 border border-border rounded-md bg-background text-foreground text-sm"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {intentLabel(s)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[kw.status]}`}>
                            {intentLabel(kw.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3 flex-wrap">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(kw.id)}
                                disabled={savingEdit}
                                className="flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400 text-sm disabled:opacity-50"
                              >
                                <Check size={16} />
                                Save
                              </button>
                              <button onClick={cancelEdit} className="flex items-center gap-1 text-caption hover:text-foreground text-sm">
                                <X size={16} />
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRunCheck(kw.id)}
                                disabled={checkingId === kw.id}
                                className="flex items-center gap-1.5 text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange text-sm disabled:opacity-50"
                              >
                                <PlayCircle size={16} />
                                {checkingId === kw.id ? "Checking..." : "Check Rank"}
                              </button>
                              <button
                                onClick={() => handleRefreshMetrics(kw.id)}
                                disabled={refreshingId === kw.id}
                                className="flex items-center gap-1.5 text-caption hover:text-foreground text-sm disabled:opacity-50"
                                title="Refresh search volume & difficulty"
                              >
                                <RefreshCw size={16} />
                                {refreshingId === kw.id ? "Refreshing..." : "Refresh Metrics"}
                              </button>
                              <button onClick={() => startEdit(kw)} className="text-caption hover:text-foreground" title="Edit keyword">
                                <Pencil size={16} />
                              </button>
                              <DeleteButton id={kw.id} onDelete={deleteTrackedKeyword} entityName="keyword" />
                            </>
                          )}
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
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
          <input
            type="text"
            value={competitorName}
            onChange={(e) => setCompetitorName(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
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
