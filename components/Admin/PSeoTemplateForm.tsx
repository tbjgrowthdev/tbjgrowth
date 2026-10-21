"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPSeoTemplate, updatePSeoTemplate, deletePSeoTemplate } from "@/app/(admin)/actions/programmatic-seo";
import { Save, AlertCircle, Plus, Trash2 } from "lucide-react";

type InitialData = Partial<{
  id: string;
  name: string;
  slugTemplate: string;
  titleTemplate: string;
  metaDescriptionTemplate: string | null;
  h1Template: string | null;
  bodyTemplate: string;
  requiredColumns: string;
  minWordCount: number;
  duplicateSimilarityThreshold: number;
  isIndexable: boolean;
}>;

function parseColumnList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string" && c.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export default function PSeoTemplateForm({ initialData = null }: { initialData?: InitialData | null }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slugTemplate: initialData?.slugTemplate || "",
    titleTemplate: initialData?.titleTemplate || "",
    metaDescriptionTemplate: initialData?.metaDescriptionTemplate || "",
    h1Template: initialData?.h1Template || "",
    bodyTemplate: initialData?.bodyTemplate || "",
    minWordCount: initialData?.minWordCount ?? 300,
    duplicateSimilarityThreshold: initialData?.duplicateSimilarityThreshold ?? 0.5,
    isIndexable: initialData?.isIndexable ?? true,
  });
  const [requiredColumns, setRequiredColumns] = useState<string[]>(
    initialData?.requiredColumns ? parseColumnList(initialData.requiredColumns) : [""]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        minWordCount: Number(formData.minWordCount),
        duplicateSimilarityThreshold: Number(formData.duplicateSimilarityThreshold),
        requiredColumns: JSON.stringify(requiredColumns.map((c) => c.trim()).filter(Boolean)),
      };

      const result = initialData?.id ? await updatePSeoTemplate(initialData.id, dataToSave) : await createPSeoTemplate(dataToSave);

      if (result.success) {
        router.push(initialData?.id ? `/admin/programmatic-seo/${initialData.id}` : `/admin/programmatic-seo/${result.data.id}`);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData?.id) return;
    if (!confirm("Delete this template, every dataset uploaded to it, and every page it generated? This can't be undone.")) return;
    setIsDeleting(true);
    const result = await deletePSeoTemplate(initialData.id);
    setIsDeleting(false);
    if (result.success) {
      router.push("/admin/programmatic-seo");
    } else {
      setError(result.error);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";
  const monoClass = `${inputClass} font-mono text-sm`;
  const labelClass = "block text-sm font-medium text-muted mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Template</h2>
        <p className="text-sm text-caption mb-6">
          Write any field below using <code className="text-xs">{"{{column}}"}</code> placeholders — they&apos;re filled in from each dataset
          row&apos;s matching column name when pages are generated.
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Template Name</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} className={inputClass} placeholder="e.g. Service in City" />
          </div>
          <div>
            <label className={labelClass}>
              URL Slug Template <span className="text-caption font-normal">(page: /pSEO/...)</span>
            </label>
            <input type="text" name="slugTemplate" required value={formData.slugTemplate} onChange={handleChange} className={monoClass} placeholder="{{service}}-in-{{city}}" />
          </div>
          <div>
            <label className={labelClass}>Title Template</label>
            <input type="text" name="titleTemplate" required value={formData.titleTemplate} onChange={handleChange} className={monoClass} placeholder="{{service}} in {{city}} | TBJ Growth" />
          </div>
          <div>
            <label className={labelClass}>H1 Template (optional — falls back to title)</label>
            <input type="text" name="h1Template" value={formData.h1Template} onChange={handleChange} className={monoClass} placeholder="{{service}} in {{city}}" />
          </div>
          <div>
            <label className={labelClass}>Meta Description Template (optional)</label>
            <textarea name="metaDescriptionTemplate" rows={2} value={formData.metaDescriptionTemplate} onChange={handleChange} className={monoClass} />
          </div>
          <div>
            <label className={labelClass}>Body Template (HTML)</label>
            <textarea
              name="bodyTemplate"
              required
              rows={10}
              value={formData.bodyTemplate}
              onChange={handleChange}
              className={monoClass}
              placeholder={"<p>{{service}} services for businesses in {{city}}. Our team helps {{city}} companies grow through {{service}}...</p>"}
            />
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">Required Columns</h2>
          <button
            type="button"
            onClick={() => setRequiredColumns((prev) => [...prev, ""])}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
          >
            <Plus size={16} /> Add Column
          </button>
        </div>
        <p className="text-sm text-caption mb-6">
          Column names that must have a non-empty value for a row to generate at all — a row missing one of these is flagged low-value and
          held for review instead of becoming a page.
        </p>
        <div className="space-y-3">
          {requiredColumns.map((col, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={col}
                onChange={(e) => setRequiredColumns((prev) => prev.map((c, i) => (i === index ? e.target.value : c)))}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-mono"
                placeholder="e.g. city"
              />
              <button type="button" onClick={() => setRequiredColumns((prev) => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 px-1" aria-label="Remove column">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">Quality Guardrails</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Minimum Word Count</label>
            <input
              type="number"
              name="minWordCount"
              min={0}
              value={formData.minWordCount}
              onChange={handleChange}
              className={inputClass}
            />
            <p className="text-xs text-caption mt-1">Pages rendering below this are flagged thin content.</p>
          </div>
          <div>
            <label className={labelClass}>Duplicate Similarity Threshold</label>
            <input
              type="number"
              name="duplicateSimilarityThreshold"
              min={0}
              max={1}
              step={0.05}
              value={formData.duplicateSimilarityThreshold}
              onChange={handleChange}
              className={inputClass}
            />
            <p className="text-xs text-caption mt-1">Word-overlap with another page from this template at or above this (0–1) is flagged a duplicate.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-foreground">
          <input
            type="checkbox"
            checked={formData.isIndexable}
            onChange={(e) => setFormData((prev) => ({ ...prev, isIndexable: e.target.checked }))}
          />
          Indexable (master switch — off takes every page from this template out of the index regardless of guardrail status)
        </label>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-border">
        {initialData?.id ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 size={18} />
            {isDeleting ? "Deleting..." : "Delete Template"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Save Template"}
        </button>
      </div>
    </form>
  );
}
