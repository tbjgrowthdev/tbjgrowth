"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { searchAllContent } from "@/app/(admin)/actions/content-search";
import type { SearchResultItem, SearchFilters, ContentKind } from "@/lib/content-search";
import { Search, X, FileText, FileEdit, Briefcase, LayoutGrid, AlertTriangle } from "lucide-react";

const TYPE_LABEL: Record<ContentKind, { label: string; icon: typeof FileText }> = {
  POST: { label: "Post", icon: FileEdit },
  PAGE: { label: "Page", icon: FileText },
  CASE_STUDY: { label: "Case Study", icon: Briefcase },
  SERVICE: { label: "Service", icon: LayoutGrid },
};

const STATUS_OPTIONS = ["DRAFT", "REVIEW", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

const EMPTY_FILTERS: SearchFilters = {};

export default function ContentSearchClient({ facets }: { facets: { categories: string[]; tags: string[]; authors: string[] } }) {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      const data = await searchAllContent(filters);
      setResults(data);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [filters]);

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="space-y-6">
      <div className="bg-card p-4 rounded-lg border border-border space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-caption" />
          <input
            type="text"
            value={filters.query || ""}
            onChange={(e) => update("query", e.target.value)}
            placeholder="Search by title or slug..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <Select label="Type" value={filters.type || ""} onChange={(v) => update("type", v as ContentKind)}>
            <option value="">Any type</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>

          <Select label="Status" value={filters.status || ""} onChange={(v) => update("status", v)}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          <Select label="SEO Status" value={filters.seoStatus || ""} onChange={(v) => update("seoStatus", v as "indexable" | "noindex")}>
            <option value="">Any</option>
            <option value="indexable">Indexable</option>
            <option value="noindex">Noindex</option>
          </Select>

          <Select label="Author" value={filters.author || ""} onChange={(v) => update("author", v)}>
            <option value="">Any author</option>
            {facets.authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>

          <Select label="Category" value={filters.category || ""} onChange={(v) => update("category", v)}>
            <option value="">Any category</option>
            {facets.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>

          <Select label="Tag" value={filters.tag || ""} onChange={(v) => update("tag", v)}>
            <option value="">Any tag</option>
            {facets.tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>

          <TextField label="Focus Keyword" value={filters.keyword || ""} onChange={(v) => update("keyword", v)} placeholder="Contains..." />

          <DateField label="Published From" value={filters.publishedFrom || ""} onChange={(v) => update("publishedFrom", v)} />
          <DateField label="Published To" value={filters.publishedTo || ""} onChange={(v) => update("publishedTo", v)} />
          <DateField label="Modified From" value={filters.modifiedFrom || ""} onChange={(v) => update("modifiedFrom", v)} />
          <DateField label="Modified To" value={filters.modifiedTo || ""} onChange={(v) => update("modifiedTo", v)} />
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border">
          <Checkbox label="Missing metadata" checked={!!filters.missingMetadata} onChange={(v) => update("missingMetadata", v)} />
          <Checkbox label="Missing schema" checked={!!filters.missingSchema} onChange={(v) => update("missingSchema", v)} />
          <Checkbox label="Missing alt text" checked={!!filters.missingAlt} onChange={(v) => update("missingAlt", v)} />
          {activeCount > 0 && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-caption hover:text-foreground ml-auto">
              <X size={12} />
              Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-6 py-3 border-b border-border text-sm text-caption">
          {loading ? "Searching..." : `${results?.length ?? 0} result${(results?.length ?? 0) === 1 ? "" : "s"}`}
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-background">
              <th className="px-6 py-3 font-medium text-caption">Type</th>
              <th className="px-6 py-3 font-medium text-caption">Title / Slug</th>
              <th className="px-6 py-3 font-medium text-caption">Author</th>
              <th className="px-6 py-3 font-medium text-caption">Status</th>
              <th className="px-6 py-3 font-medium text-caption">SEO</th>
              <th className="px-6 py-3 font-medium text-caption">Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(results ?? []).map((item) => {
              const TypeIcon = TYPE_LABEL[item.type].icon;
              const missingMeta = !item.metaTitle?.trim() || !item.metaDescription?.trim();
              const missingSchema = !item.schemaJson?.trim();
              const missingAlt = Boolean(item.featuredImage) && !item.featuredImageAlt?.trim();
              return (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-background">
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-1.5 text-caption">
                      <TypeIcon size={14} />
                      {TYPE_LABEL[item.type].label}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <Link href={item.adminUrl} className="font-medium text-foreground hover:text-brand-orange-deep">
                      {item.title}
                    </Link>
                    {item.slug && <div className="text-xs text-caption font-mono">{item.slug}</div>}
                  </td>
                  <td className="px-6 py-3 text-caption">{item.authorName || "—"}</td>
                  <td className="px-6 py-3 text-caption">{item.status || "—"}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      {!item.isIndexable && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-caption">noindex</span>}
                      {(missingMeta || missingSchema || missingAlt) && (
                        <span title={[missingMeta && "Missing metadata", missingSchema && "Missing schema", missingAlt && "Missing alt text"].filter(Boolean).join(", ")}>
                          <AlertTriangle size={14} className="text-amber-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-caption text-xs whitespace-nowrap">{new Date(item.updatedAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {results && results.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-caption">
                  No content matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-caption">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm">
        {children}
      </select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-caption">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
      />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-caption">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 rounded border-border" />
      {label}
    </label>
  );
}
