"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, FileEdit, Briefcase, LayoutGrid, Folder, Tag } from "lucide-react";
import { PREFIXED_LOCALES } from "@/lib/i18n";

type RowType = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "CATEGORY" | "TAG";
type TranslationStatus = "NOT_STARTED" | "DRAFT" | "PUBLISHED";

type Row = {
  id: string;
  type: RowType;
  title: string;
  detail: string;
  statuses: Record<string, TranslationStatus>;
};

const TYPE_META: Record<RowType, { label: string; icon: typeof FileText }> = {
  POST: { label: "Post", icon: FileEdit },
  PAGE: { label: "Page", icon: FileText },
  CASE_STUDY: { label: "Case Study", icon: Briefcase },
  SERVICE: { label: "Service", icon: LayoutGrid },
  CATEGORY: { label: "Category", icon: Folder },
  TAG: { label: "Tag", icon: Tag },
};

const STATUS_BADGE: Record<TranslationStatus, string> = {
  NOT_STARTED: "bg-background text-caption border border-border",
  DRAFT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_LABEL: Record<TranslationStatus, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  PUBLISHED: "Published",
};

export default function TranslationsListClient({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RowType | "">("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter && row.type !== typeFilter) return false;
      if (q && !row.title.toLowerCase().includes(q) && !row.detail.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-caption" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or slug..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as RowType | "")}
          className="px-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
        >
          <option value="">Any type</option>
          {Object.entries(TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Content</th>
              <th className="px-6 py-4 font-medium text-caption">Type</th>
              {PREFIXED_LOCALES.map((locale) => (
                <th key={locale.code} className="px-4 py-4 font-medium text-caption text-center whitespace-nowrap">
                  {locale.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2 + PREFIXED_LOCALES.length} className="px-6 py-8 text-center text-caption">
                  {rows.length === 0 ? "No translatable content yet." : "Nothing matches your search."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const Icon = TYPE_META[row.type].icon;
                return (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{row.title}</div>
                      {row.detail && <div className="text-xs text-caption font-mono">{row.detail}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                        <Icon size={14} />
                        {TYPE_META[row.type].label}
                      </span>
                    </td>
                    {PREFIXED_LOCALES.map((locale) => {
                      const status = row.statuses[locale.code] ?? "NOT_STARTED";
                      return (
                        <td key={locale.code} className="px-4 py-4 text-center">
                          <Link
                            href={`/admin/translations/${row.type}/${row.id}/${locale.code}`}
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${STATUS_BADGE[status]}`}
                          >
                            {STATUS_LABEL[status]}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
