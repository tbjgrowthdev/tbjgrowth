"use client";

import { useState } from "react";
import { getContentVersionHistory, compareContentVersions, restoreContentVersion } from "@/app/(admin)/actions/versioning";
import { History, RotateCcw, GitCompare } from "lucide-react";

type ContentType = "POST" | "PAGE" | "CASE_STUDY";

type VersionEntry = {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: Date | string;
};

type CompareSnapshot = { versionNumber: number; snapshot: Record<string, unknown>; createdAt: Date | string; authorName: string | null } | null;

export default function VersionHistoryPanel({ contentType, contentId }: { contentType: ContentType; contentId: string }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [compareResult, setCompareResult] = useState<{ a: CompareSnapshot; b: CompareSnapshot } | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = async () => {
    setOpen((prev) => !prev);
    if (versions === null) {
      const data = await getContentVersionHistory(contentType, contentId);
      setVersions(data as unknown as VersionEntry[]);
    }
  };

  const toggleSelect = (versionNumber: number) => {
    setCompareResult(null);
    setSelected((prev) => {
      if (prev.includes(versionNumber)) return prev.filter((v) => v !== versionNumber);
      if (prev.length >= 2) return [prev[1], versionNumber];
      return [...prev, versionNumber];
    });
  };

  const handleCompare = async () => {
    if (selected.length !== 2) return;
    const [a, b] = [...selected].sort((x, y) => x - y);
    const result = await compareContentVersions(contentType, contentId, a, b);
    setCompareResult(result);
  };

  const handleRestore = async (versionNumber: number) => {
    if (!confirm(`Restore version ${versionNumber}? This won't delete any history — it creates a new version with that content.`)) return;
    setRestoring(versionNumber);
    try {
      const result = await restoreContentVersion(contentType, contentId, versionNumber);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || "Failed to restore");
        setRestoring(null);
      }
    } catch {
      setRestoring(null);
    }
  };

  const allFieldKeys = compareResult
    ? Array.from(new Set([...Object.keys(compareResult.a?.snapshot || {}), ...Object.keys(compareResult.b?.snapshot || {})]))
    : [];

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
      <button type="button" onClick={load} className="flex items-center gap-2 text-xl font-semibold text-foreground">
        <History size={20} />
        Version History
      </button>

      {open && (
        <div className="space-y-3">
          {versions === null ? (
            <p className="text-sm text-caption">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-caption">No versions recorded yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-caption">Select two versions to compare, or restore one directly.</p>
                {selected.length === 2 && (
                  <button
                    type="button"
                    onClick={handleCompare}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-border hover:bg-tint"
                  >
                    <GitCompare size={14} /> Compare v{Math.min(...selected)} vs v{Math.max(...selected)}
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 text-sm border border-border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(v.versionNumber)}
                      onChange={() => toggleSelect(v.versionNumber)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-foreground w-10">v{v.versionNumber}</span>
                    <span className="text-caption flex-1 truncate">
                      {v.changeSummary || <em>No summary</em>} — {v.authorName || v.authorEmail || "Unknown"}
                    </span>
                    <span className="text-caption text-xs whitespace-nowrap">{new Date(v.createdAt).toLocaleString()}</span>
                    <button
                      type="button"
                      disabled={restoring === v.versionNumber}
                      onClick={() => handleRestore(v.versionNumber)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-background border border-border hover:bg-tint disabled:opacity-50"
                      title="Restore this version (creates a new version, doesn't erase history)"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                  </div>
                ))}
              </div>

              {compareResult && (
                <div className="border-t border-border pt-4 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">
                    v{compareResult.a?.versionNumber} vs v{compareResult.b?.versionNumber}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-background">
                          <th className="px-2 py-1.5 text-left font-medium text-muted">Field</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted">v{compareResult.a?.versionNumber}</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted">v{compareResult.b?.versionNumber}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {allFieldKeys.map((key) => {
                          const valA = compareResult.a?.snapshot[key];
                          const valB = compareResult.b?.snapshot[key];
                          const changed = JSON.stringify(valA) !== JSON.stringify(valB);
                          return (
                            <tr key={key} className={changed ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                              <td className="px-2 py-1.5 font-medium text-foreground whitespace-nowrap">{key}</td>
                              <td className="px-2 py-1.5 text-caption max-w-[280px] truncate" title={String(valA ?? "")}>
                                {formatValue(valA)}
                              </td>
                              <td className="px-2 py-1.5 text-caption max-w-[280px] truncate" title={String(valB ?? "")}>
                                {formatValue(valB)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
