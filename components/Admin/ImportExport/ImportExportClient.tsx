"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, FileJson, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import {
  exportPages,
  importPages,
  exportPosts,
  importPosts,
  exportCaseStudies,
  importCaseStudies,
  exportServices,
  importServices,
  exportCategories,
  importCategories,
  exportTags,
  importTags,
  exportRedirects,
  exportMedia,
  importMedia,
  exportSeo,
  importSeo,
} from "@/app/(admin)/actions/import-export";
import { bulkImportRedirects } from "@/app/(admin)/actions/redirects";

type ImportResult = { created: number; updated: number; skipped: number; errors: string[] };
type ImportResponse = ({ success: true } & ImportResult) | { success: false; error: string };
type ExportResponse = { success: true; data: string } | { success: false; error: string };
type ExportFn = () => Promise<ExportResponse>;
type ImportFn = (text: string) => Promise<ImportResponse>;

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Adapts bulkImportRedirects' { created, skipped, errors } (no `updated` —
// redirects are always created or skipped, never merged) into the shared
// ImportResponse shape every other Section in this page expects.
async function importRedirects(text: string): Promise<ImportResponse> {
  const r = await bulkImportRedirects(text);
  if (!r.success) {
    return { success: false, error: r.errors?.[0] || "Import failed" };
  }
  return { success: true, created: r.created, updated: 0, skipped: r.skipped, errors: r.errors };
}

function Section({
  title,
  description,
  format,
  count,
  fileName,
  onExport,
  onImport,
}: {
  title: string;
  description: string;
  format: "json" | "csv";
  count: number;
  fileName: string;
  onExport: ExportFn;
  onImport: ImportFn;
}) {
  const router = useRouter();
  const inputId = `import-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const Icon = format === "json" ? FileJson : FileSpreadsheet;
  const mime = format === "json" ? "application/json" : "text/csv";

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    const res = await onExport();
    if (res.success) {
      download(fileName, res.data, mime);
    } else {
      setError(res.error || "Export failed");
    }
    setIsExporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const res = await onImport(text);
      if (res.success) {
        setResult(res);
        router.refresh();
      } else {
        setError(res.error || "Import failed");
      }
    } catch (err: any) {
      setError(err.message || "Could not read file");
    }
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-border space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon size={20} className="text-brand-orange-deep dark:text-brand-orange-light mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-caption">{description}</p>
          </div>
        </div>
        <span className="text-xs text-caption whitespace-nowrap">
          {count} record{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-foreground text-background rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          {isExporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={format === "json" ? ".json,application/json" : ".csv,text/csv"}
          onChange={handleFileChange}
          className="hidden"
          id={inputId}
        />
        <label
          htmlFor={inputId}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-tint transition-colors cursor-pointer ${isImporting ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Upload size={14} />
          {isImporting ? "Importing..." : `Import ${format.toUpperCase()}`}
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {result && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 size={14} />
            {result.created} created, {result.updated} updated, {result.skipped} skipped
            {result.errors.length > 0 ? `, ${result.errors.length} issue${result.errors.length > 1 ? "s" : ""}` : ""}
          </div>
          {result.errors.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-5 space-y-0.5 max-h-32 overflow-auto">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type Counts = {
  pages: number;
  posts: number;
  caseStudies: number;
  services: number;
  categories: number;
  tags: number;
  redirects: number;
  media: number;
};

export default function ImportExportClient({ counts }: { counts: Counts }) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-900/50 text-sm text-amber-800 dark:text-amber-300 p-4 rounded-lg">
        Importing creates or updates records but never changes publish status or approval assignments — imported
        pages/posts/case studies always land as drafts, and updates to existing records never touch who&apos;s
        reviewing them or where they are in the workflow. A record someone else currently has open for editing is
        skipped, not overwritten, and every import is written to the audit log.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title="Pages"
          description="Title, content, and SEO fields. Matched by slug."
          format="json"
          count={counts.pages}
          fileName="pages.json"
          onExport={exportPages}
          onImport={importPages}
        />
        <Section
          title="Posts"
          description="Content, categories, tags, and SEO fields. Matched by slug."
          format="json"
          count={counts.posts}
          fileName="posts.json"
          onExport={exportPosts}
          onImport={importPosts}
        />
        <Section
          title="Case Studies"
          description="Client/results content, categories, tags, and SEO fields. Matched by slug."
          format="json"
          count={counts.caseStudies}
          fileName="case-studies.json"
          onExport={exportCaseStudies}
          onImport={importCaseStudies}
        />
        <Section
          title="Services"
          description="Service detail content and FAQs. Matched by slug."
          format="json"
          count={counts.services}
          fileName="services.json"
          onExport={exportServices}
          onImport={importServices}
        />
        <Section
          title="SEO Metadata"
          description="Meta/OG/Twitter/schema fields for every page, post, case study, and service in one sheet. Matched by content type + slug."
          format="csv"
          count={counts.pages + counts.posts + counts.caseStudies + counts.services}
          fileName="seo-metadata.csv"
          onExport={exportSeo}
          onImport={importSeo}
        />
        <Section
          title="Redirects"
          description="301/302/307/410 rules."
          format="csv"
          count={counts.redirects}
          fileName="redirects.csv"
          onExport={exportRedirects}
          onImport={importRedirects}
        />
        <Section
          title="Categories"
          description="Blog/case-study categories. Matched by name."
          format="csv"
          count={counts.categories}
          fileName="categories.csv"
          onExport={exportCategories}
          onImport={importCategories}
        />
        <Section
          title="Tags"
          description="Blog/case-study tags. Matched by name."
          format="csv"
          count={counts.tags}
          fileName="tags.csv"
          onExport={exportTags}
          onImport={importTags}
        />
        <Section
          title="Media Metadata"
          description="Title/alt-text/folder only — updates existing Media Library assets, never uploads new files. Matched by publicId/URL."
          format="csv"
          count={counts.media}
          fileName="media-metadata.csv"
          onExport={exportMedia}
          onImport={importMedia}
        />
      </div>
    </div>
  );
}
