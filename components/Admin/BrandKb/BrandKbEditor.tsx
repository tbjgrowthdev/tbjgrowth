"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { activateBrandSectionVersionAction, getBrandSectionDetailAction, saveBrandSectionVersionAction } from "@/app/(admin)/actions/brand-kb";
import { SECTION_HELP, SECTION_LABEL } from "@/lib/brand-kb/constants";
import type { BrandSectionKey } from "@/lib/generated/prisma/client";

type Detail = Awaited<ReturnType<typeof getBrandSectionDetailAction>>;
type Section = NonNullable<NonNullable<Detail>["section"]>;

export default function BrandKbEditor({
  sectionKey,
  section,
  authors,
}: {
  sectionKey: BrandSectionKey;
  section: Section | null;
  authors: Record<string, string>;
}) {
  const router = useRouter();
  const active = section?.activeVersion;

  const [content, setContent] = useState(active?.content || "");
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveBrandSectionVersionAction(sectionKey, { content, changeNote: changeNote || undefined });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setChangeNote("");
    setSaved(true);
    router.refresh();
  };

  const rollback = async (versionId: string) => {
    if (!section) return;
    setBusy(true);
    setError(null);
    const result = await activateBrandSectionVersionAction(section.id, versionId);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/brand-kb" className="text-sm text-caption hover:text-foreground">
          ← Brand Knowledge Base
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">{SECTION_LABEL[sectionKey]}</h1>
        <p className="text-caption text-sm mt-1">{SECTION_HELP[sectionKey]}</p>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={14} /> Saved as the new active version.
        </p>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder={sectionKey === "FORBIDDEN_TERMS" ? "One term or phrase per line" : undefined}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Change note (optional)</label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="What changed and why"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>
        <button
          type="button"
          disabled={busy || !content.trim()}
          onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {section ? "Save as new version" : "Create first version"}
        </button>
      </div>

      {section && section.versions.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <h2 className="text-lg font-semibold text-foreground p-6 pb-4">Version history</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-y border-border">
                <th className="px-6 py-2 font-medium text-caption">Version</th>
                <th className="px-6 py-2 font-medium text-caption">Created by</th>
                <th className="px-6 py-2 font-medium text-caption">Created</th>
                <th className="px-6 py-2 font-medium text-caption">Note</th>
                <th className="px-6 py-2 font-medium text-caption text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {section.versions.map((v) => {
                const isActive = v.id === section.activeVersionId;
                return (
                  <tr key={v.id} className={isActive ? "bg-tint" : ""}>
                    <td className="px-6 py-3 text-foreground font-medium">
                      v{v.versionNumber}
                      {isActive && <span className="ml-2 text-xs font-medium text-brand-orange-deep dark:text-brand-orange-light">Active</span>}
                    </td>
                    <td className="px-6 py-3 text-caption">{authors[v.createdById] || "Unknown"}</td>
                    <td className="px-6 py-3 text-caption">{new Date(v.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-3 text-caption max-w-xs truncate" title={v.changeNote || ""}>
                      {v.changeNote || "—"}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {!isActive && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => rollback(v.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-md hover:bg-background disabled:opacity-50 ml-auto"
                        >
                          <RotateCcw size={12} />
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
