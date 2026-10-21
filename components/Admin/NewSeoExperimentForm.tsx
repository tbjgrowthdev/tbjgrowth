"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createSeoExperimentAction } from "@/app/(admin)/actions/seo-experiments";
import { AlertCircle, Save } from "lucide-react";

const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

type ContentItem = {
  contentType: "POST" | "PAGE" | "CASE_STUDY" | "SERVICE";
  contentId: string;
  title: string;
  path: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string | null;
};

const TYPE_LABEL: Record<ContentItem["contentType"], string> = {
  POST: "Blog Posts",
  PAGE: "Pages",
  CASE_STUDY: "Case Studies",
  SERVICE: "Services",
};

const VARIABLE_OPTIONS = [
  { value: "TITLE", label: "Title", field: "metaTitle" as const },
  { value: "META_DESCRIPTION", label: "Meta Description", field: "metaDescription" as const },
  { value: "CTA", label: "CTA", field: "content" as const },
  { value: "INTERNAL_LINKS", label: "Internal Links", field: "content" as const },
  { value: "CONTENT_SECTION", label: "Content Section", field: "content" as const },
] as const;

export default function NewSeoExperimentForm({ content }: { content: ContentItem[] }) {
  const router = useRouter();
  const [contentKey, setContentKey] = useState("");
  const [variable, setVariable] = useState<(typeof VARIABLE_OPTIONS)[number]["value"]>("TITLE");
  const [name, setName] = useState("");
  const [afterValue, setAfterValue] = useState("");
  const [baselineWindowDays, setBaselineWindowDays] = useState(28);
  const [evaluationWindowDays, setEvaluationWindowDays] = useState(28);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<ContentItem["contentType"], ContentItem[]>();
    for (const c of content) {
      const list = groups.get(c.contentType) ?? [];
      list.push(c);
      groups.set(c.contentType, list);
    }
    return groups;
  }, [content]);

  const selected = useMemo(() => {
    const [contentType, contentId] = contentKey.split(":");
    return content.find((c) => c.contentType === contentType && c.contentId === contentId) ?? null;
  }, [content, contentKey]);

  const field = VARIABLE_OPTIONS.find((v) => v.value === variable)!.field;

  const applySelection = (nextContentKey: string, nextVariable: typeof variable) => {
    setContentKey(nextContentKey);
    setVariable(nextVariable);
    const [contentType, contentId] = nextContentKey.split(":");
    const item = content.find((c) => c.contentType === contentType && c.contentId === contentId) ?? null;
    const nextField = VARIABLE_OPTIONS.find((v) => v.value === nextVariable)!.field;
    setAfterValue((item?.[nextField] as string) || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Pick a piece of content first.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const result = await createSeoExperimentAction({
      name: name.trim() || `${VARIABLE_OPTIONS.find((v) => v.value === variable)!.label} test on ${selected.title}`,
      contentType: selected.contentType,
      contentId: selected.contentId,
      variable,
      afterValue,
      baselineWindowDays: Number(baselineWindowDays),
      evaluationWindowDays: Number(evaluationWindowDays),
    });
    setIsSubmitting(false);
    if (result.success) {
      router.push(`/admin/seo-experiments/${result.data.id}`);
    } else {
      setError(result.error);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";
  const labelClass = "block text-sm font-medium text-muted mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
        <h2 className="text-xl font-bold text-foreground mb-2">What to Test</h2>
        <div>
          <label className={labelClass}>Content</label>
          <select value={contentKey} onChange={(e) => applySelection(e.target.value, variable)} required className={inputClass}>
            <option value="">Select a page...</option>
            {Array.from(grouped.entries()).map(([type, items]) => (
              <optgroup key={type} label={TYPE_LABEL[type]}>
                {items.map((c) => (
                  <option key={`${c.contentType}:${c.contentId}`} value={`${c.contentType}:${c.contentId}`}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selected?.path && <p className="text-xs text-caption mt-1">{selected.path}</p>}
        </div>
        <div>
          <label className={labelClass}>Variable Under Test</label>
          <select value={variable} onChange={(e) => applySelection(contentKey, e.target.value as typeof variable)} className={inputClass}>
            {VARIABLE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Experiment Name (optional)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Shorter, benefit-led title" />
        </div>
      </div>

      {selected && (
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border space-y-4">
          <h2 className="text-xl font-bold text-foreground mb-2">Before → After</h2>
          <div>
            <label className={labelClass}>Current value (snapshotted as &ldquo;before&rdquo; when launched)</label>
            {field === "content" ? (
              <div className="border border-border rounded-lg p-3 bg-background text-sm text-caption max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: selected.content || "<em>(empty)</em>" }} />
            ) : (
              <p className="border border-border rounded-lg p-3 bg-background text-sm text-caption">{(selected[field] as string) || "(empty)"}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>New value to test</label>
            {field === "content" ? (
              <RichTextEditor content={afterValue} onChange={(value: string) => setAfterValue(value)} />
            ) : field === "metaDescription" ? (
              <textarea value={afterValue} onChange={(e) => setAfterValue(e.target.value)} rows={3} className={inputClass} />
            ) : (
              <input type="text" value={afterValue} onChange={(e) => setAfterValue(e.target.value)} className={inputClass} />
            )}
          </div>
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Measurement Windows</h2>
        <p className="text-sm text-caption mb-6">
          &ldquo;Before&rdquo; is measured over the baseline window immediately preceding launch; &ldquo;after&rdquo; is measured from launch through the
          evaluation window, both from Search Console/GA4 data already imported.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Baseline Window (days)</label>
            <input type="number" min={1} value={baselineWindowDays} onChange={(e) => setBaselineWindowDays(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Evaluation Window (days)</label>
            <input type="number" min={1} value={evaluationWindowDays} onChange={(e) => setEvaluationWindowDays(Number(e.target.value))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting || !selected}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Create Experiment (Draft)"}
        </button>
      </div>
    </form>
  );
}
