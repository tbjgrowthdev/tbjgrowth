"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { activatePromptVersionAction, getPromptTemplateDetailAction, savePromptVersionAction } from "@/app/(admin)/actions/content-pipeline";
import { CATEGORY_LABEL, WIRED_CATEGORIES } from "@/lib/content-pipeline/prompt-constants";
import type { PromptCategory } from "@/lib/generated/prisma/client";

type Detail = Awaited<ReturnType<typeof getPromptTemplateDetailAction>>;
type Template = NonNullable<NonNullable<Detail>["template"]>;

const PLACEHOLDER_HINT: Partial<Record<PromptCategory, string>> = {
  BLOG: "{{topic}}, {{title}}, {{keyword}}, {{goal}}, {{audience}}, {{tone}}",
  CASE_STUDY: "{{topic}}, {{title}}, {{keyword}}, {{goal}}, {{audience}}, {{tone}}",
  SEO: "{{title}}, {{keyword}}",
};

export default function PromptEditor({
  category,
  template,
  authors,
  defaultBodyTemplate,
}: {
  category: PromptCategory;
  template: Template | null;
  authors: Record<string, string>;
  defaultBodyTemplate: string;
}) {
  const router = useRouter();
  const active = template?.activeVersion;
  const isWired = WIRED_CATEGORIES.includes(category);

  const [name, setName] = useState(template?.name || `${CATEGORY_LABEL[category]} prompt`);
  const [description, setDescription] = useState(template?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(active?.systemPrompt || "");
  const [bodyTemplate, setBodyTemplate] = useState(active?.bodyTemplate ?? defaultBodyTemplate);
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await savePromptVersionAction(category, {
      name,
      description: description || undefined,
      systemPrompt: systemPrompt || undefined,
      bodyTemplate,
      changeNote: changeNote || undefined,
    });
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
    if (!template) return;
    setBusy(true);
    setError(null);
    const result = await activatePromptVersionAction(template.id, versionId);
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
        <Link href="/admin/ai-pipeline/prompts" className="text-sm text-caption hover:text-foreground">
          ← Prompt Library
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">{CATEGORY_LABEL[category]} prompt</h1>
        {!isWired && (
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2 mt-2">
            <AlertTriangle size={14} />
            No pipeline stage reads this category yet — saved here so it&apos;s ready once one does.
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {saved && (
        <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={14} /> Saved as the new active version.
        </p>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">System prompt override (optional)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={2}
            placeholder="Leave blank to use the pipeline's default persona/system text"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Prompt body</label>
          <textarea
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={12}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground font-mono text-sm"
          />
          {PLACEHOLDER_HINT[category] && <p className="text-xs text-caption mt-1">Available placeholders: {PLACEHOLDER_HINT[category]}</p>}
          {isWired && (
            <p className="text-xs text-caption mt-1">
              This replaces only the instructional text above — the pipeline still generates its own context (brief/outline/keyword) before it and its
              own required JSON output format after it, so this can&apos;t break parsing.
            </p>
          )}
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
          disabled={busy || !bodyTemplate.trim()}
          onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm font-medium"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {template ? "Save as new version" : "Create first version"}
        </button>
      </div>

      {template && template.versions.length > 0 && (
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
              {template.versions.map((v) => {
                const isActive = v.id === template.activeVersionId;
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
