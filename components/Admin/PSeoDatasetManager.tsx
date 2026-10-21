"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, Loader2, ChevronDown, ChevronUp, Trash2, ExternalLink, CheckCircle2 } from "lucide-react";
import {
  uploadPSeoDataset,
  deletePSeoDataset,
  runPSeoGeneration,
  listPSeoPages,
  overridePSeoPage,
} from "@/app/(admin)/actions/programmatic-seo";

type Dataset = {
  id: string;
  name: string;
  columns: string;
  rowCount: number;
  createdAt: Date | string;
  _count: { rows: number };
};

type PageRow = Awaited<ReturnType<typeof listPSeoPages>>[number];

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  NEEDS_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  OVERRIDDEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function PSeoDatasetManager({ templateId, datasets }: { templateId: string; datasets: Dataset[] }) {
  const router = useRouter();
  const [uploadName, setUploadName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pagesByDataset, setPagesByDataset] = useState<Record<string, PageRow[]>>({});
  const [loadingPagesId, setLoadingPagesId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [genSummary, setGenSummary] = useState<string | null>(null);
  const [busyPageId, setBusyPageId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!uploadName) setUploadName(file.name.replace(/\.csv$/i, ""));
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadError(null);
    setUploadWarnings([]);
    const result = await uploadPSeoDataset(templateId, uploadName.trim() || "Untitled dataset", csvText);
    setUploading(false);
    if (!result.success) {
      setUploadError(result.error);
      return;
    }
    setUploadWarnings(result.data.warnings);
    setUploadName("");
    setCsvText("");
    router.refresh();
  };

  const handleGenerate = async (datasetId: string) => {
    setGeneratingId(datasetId);
    setGenSummary(null);
    const result = await runPSeoGeneration(datasetId);
    setGeneratingId(null);
    if (result.success) {
      setGenSummary(`Generated ${result.data.generated} page(s) — ${result.data.published} published, ${result.data.needsReview} need review.`);
      if (pagesByDataset[datasetId]) {
        setPagesByDataset((prev) => ({ ...prev, [datasetId]: [] }));
        await loadPages(datasetId);
      }
      router.refresh();
    } else {
      setGenSummary(result.error);
    }
  };

  const loadPages = async (datasetId: string) => {
    setLoadingPagesId(datasetId);
    const pages = await listPSeoPages(datasetId);
    setPagesByDataset((prev) => ({ ...prev, [datasetId]: pages }));
    setLoadingPagesId(null);
  };

  const toggleExpand = async (datasetId: string) => {
    if (expandedId === datasetId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(datasetId);
    if (!pagesByDataset[datasetId]) await loadPages(datasetId);
  };

  const handleOverride = async (pageId: string, datasetId: string) => {
    setBusyPageId(pageId);
    const result = await overridePSeoPage(pageId);
    setBusyPageId(null);
    if (result.success) await loadPages(datasetId);
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm("Delete this dataset and every page generated from it? This can't be undone.")) return;
    await deletePSeoDataset(datasetId);
    router.refresh();
  };

  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Upload a Dataset</h2>
        <p className="text-sm text-caption mb-6">
          A CSV whose header row names become this template&apos;s <code className="text-xs">{"{{column}}"}</code> values — one page is
          generated per data row.
        </p>
        <form onSubmit={handleUpload} className="space-y-4">
          {uploadError && <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
          {uploadWarnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-600 dark:text-amber-400">
              {w}
            </p>
          ))}
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Dataset Name</label>
            <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} className={inputClass} placeholder="e.g. UK Cities - Jan 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">CSV File</label>
            <input type="file" accept=".csv,text/csv" onChange={handleFileChange} className="text-sm text-foreground" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">...or paste CSV directly</label>
            <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={5} className={`${inputClass} font-mono text-sm`} placeholder="city,service&#10;Dhaka,SEO&#10;Chattogram,PPC" />
          </div>
          <button
            type="submit"
            disabled={uploading || !csvText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload Dataset
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Dataset</th>
              <th className="px-6 py-4 font-medium text-caption">Rows</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {datasets.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-caption">
                  No datasets uploaded yet.
                </td>
              </tr>
            ) : (
              datasets.map((d) => (
                <Fragment key={d.id}>
                  <tr className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{d.name}</td>
                    <td className="px-6 py-4 text-caption">{d._count.rows}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          disabled={generatingId === d.id}
                          onClick={() => handleGenerate(d.id)}
                          className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange disabled:opacity-50"
                        >
                          {generatingId === d.id ? "Generating..." : "Generate Pages"}
                        </button>
                        <button type="button" onClick={() => toggleExpand(d.id)} className="text-caption hover:text-foreground" title="View generated pages">
                          {expandedId === d.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button type="button" onClick={() => handleDeleteDataset(d.id)} className="text-red-500 hover:text-red-700" title="Delete dataset" aria-label="Delete dataset">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === d.id && (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 bg-background">
                        {genSummary && <p className="text-sm text-caption mb-3">{genSummary}</p>}
                        {loadingPagesId === d.id ? (
                          <p className="text-sm text-caption">Loading pages...</p>
                        ) : !pagesByDataset[d.id] || pagesByDataset[d.id].length === 0 ? (
                          <p className="text-sm text-caption">No pages generated yet — click &quot;Generate Pages&quot;.</p>
                        ) : (
                          <div className="space-y-2">
                            {pagesByDataset[d.id].map((p) => (
                              <div key={p.id} className="flex items-start justify-between gap-4 p-3 border border-border rounded-lg bg-card">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${STATUS_STYLE[p.status]}`}>{p.status.replace("_", " ")}</span>
                                    <span className="font-medium text-foreground truncate">{p.title}</span>
                                  </div>
                                  <div className="text-xs text-caption mt-0.5">/pSEO/{p.slug} — {p.wordCount} words</div>
                                  {p.guardrailFindings.length > 0 && (
                                    <ul className="mt-1 space-y-0.5">
                                      {p.guardrailFindings.map((f, i) => (
                                        <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                                          {f.category.replace("_", " ")}: {f.description}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  {p.status !== "NEEDS_REVIEW" && (
                                    <Link href={`/pSEO/${p.slug}`} target="_blank" className="text-caption hover:text-foreground" title="View live">
                                      <ExternalLink size={16} />
                                    </Link>
                                  )}
                                  {p.status === "NEEDS_REVIEW" && (
                                    <button
                                      type="button"
                                      disabled={busyPageId === p.id}
                                      onClick={() => handleOverride(p.id, d.id)}
                                      className="flex items-center gap-1 text-xs font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange disabled:opacity-50"
                                    >
                                      <CheckCircle2 size={14} />
                                      Publish anyway
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
