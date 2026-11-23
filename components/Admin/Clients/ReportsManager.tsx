"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Trash2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { createReport, setReportPublished, deleteReport } from "@/app/(admin)/actions/client-files";
import { withToast } from "@/lib/admin/toast";
import { MAX_FILE_BYTES, MAX_FILE_LABEL } from "@/lib/portal/upload-limits";

/** Browser-side size check, so an oversize file gets a clear message instead of a generic body-limit error. */
function tooBig(fd: FormData): boolean {
  const f = fd.get("file");
  return f instanceof File && f.size > MAX_FILE_BYTES;
}

type Metric = { label: string; value: string; change?: string };
type ReportRow = { id: string; period: string; title: string; summary: string | null; metrics: unknown; publishedAt: Date | string | null; project: { title: string } | null };

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const label = "block text-sm font-medium text-muted mb-1";
const btn = "inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background disabled:opacity-50";

function lastMonth(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

/** Monthly reports: upload (PDF + up to 4 headline numbers typed by hand), publish, delete. */
export default function ReportsManager({
  clientId,
  reports,
  projects,
  canManage,
}: {
  clientId: string;
  reports: ReportRow[];
  projects: Array<{ id: string; title: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metric[]>([{ label: "", value: "", change: "" }]);

  async function run<T extends { success: boolean; error?: string }>(p: Promise<T>, messages: { success: string; error: string }) {
    setBusy(true);
    setError(null);
    try {
      const r = await withToast(p, messages);
      if (!r.success) setError(r.error ?? messages.error);
      router.refresh();
      return r.success;
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("clientId", clientId);
    fd.set("metrics", JSON.stringify(metrics.filter((m) => m.label.trim() && m.value.trim())));
    if (tooBig(fd)) return setError(`The file is larger than ${MAX_FILE_LABEL}`);
    if (await run(createReport(fd), { success: "Report saved", error: "Couldn't save the report" })) {
      form.reset();
      setMetrics([{ label: "", value: "", change: "" }]);
    }
  }

  const setMetric = (i: number, k: keyof Metric, v: string) => setMetrics((ms) => ms.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <form onSubmit={upload} className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4">
        <h2 className="text-lg font-bold text-foreground">New report</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rep-period" className={label}>Month</label>
            <input id="rep-period" name="period" type="month" required defaultValue={lastMonth()} className={input} />
          </div>
          <div>
            <label htmlFor="rep-project" className={label}>Project (optional)</label>
            <select id="rep-project" name="projectId" className={input} defaultValue="">
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="rep-title" className={label}>Title</label>
          <input id="rep-title" name="title" required maxLength={200} className={input} placeholder="October results" />
        </div>
        <div>
          <label htmlFor="rep-summary" className={label}>Short summary (the client sees this)</label>
          <textarea id="rep-summary" name="summary" rows={3} maxLength={2000} className={`${input} py-2`} />
        </div>
        <fieldset className="space-y-2">
          <legend className={label}>Headline numbers (up to 4)</legend>
          {metrics.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_5.5rem] gap-2">
              <input aria-label={`Label ${i + 1}`} maxLength={40} placeholder="Leads" value={m.label} onChange={(e) => setMetric(i, "label", e.target.value)} className={input} />
              <input aria-label={`Value ${i + 1}`} maxLength={40} placeholder="42" value={m.value} onChange={(e) => setMetric(i, "value", e.target.value)} className={input} />
              <input aria-label={`Change ${i + 1}`} maxLength={20} placeholder="+12%" value={m.change ?? ""} onChange={(e) => setMetric(i, "change", e.target.value)} className={input} />
            </div>
          ))}
          {metrics.length < 4 && (
            <button type="button" className="min-h-11 text-sm text-brand-orange-deep dark:text-brand-orange-light" onClick={() => setMetrics((ms) => [...ms, { label: "", value: "", change: "" }])}>
              + Add a number
            </button>
          )}
        </fieldset>
        <div>
          <label htmlFor="rep-file" className={label}>Report file (PDF, PNG or JPG, up to {MAX_FILE_LABEL})</label>
          <input id="rep-file" name="file" type="file" required accept="application/pdf,image/png,image/jpeg" className="block w-full min-h-11 text-base" />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="publish" defaultChecked className="h-5 w-5" /> Publish now (the client is notified)
        </label>
        <button type="submit" disabled={busy} className="flex min-h-11 items-center gap-2 px-5 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
          <Upload size={18} /> {busy ? "Uploading…" : "Save report"}
        </button>
      </form>

      <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
        <h2 className="text-lg font-bold text-foreground">Reports</h2>
        {reports.length === 0 && <p className="text-sm text-caption">No reports yet.</p>}
        <ul className="divide-y divide-border">
          {reports.map((r) => (
            <li key={r.id} className="py-3 space-y-2">
              <div>
                <p className="font-medium text-foreground break-words">
                  {r.period} · {r.title}{" "}
                  <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs">{r.publishedAt ? "published" : "draft"}</span>
                </p>
                {r.project && <p className="text-sm text-caption">{r.project.title}</p>}
                {Array.isArray(r.metrics) && r.metrics.length > 0 && (
                  <p className="text-sm text-caption">{(r.metrics as Metric[]).map((m) => `${m.label}: ${m.value}${m.change ? ` (${m.change})` : ""}`).join(" · ")}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <a href={`/api/admin/client-files/${r.id}?kind=report`} className={btn}>
                    <Download size={16} /> Download
                  </a>
                )}
                <button type="button" className={btn} disabled={busy} onClick={() => run(setReportPublished(r.id, !r.publishedAt), { success: r.publishedAt ? "Back to draft" : "Published, client notified", error: "Couldn't change the report" })}>
                  {r.publishedAt ? <EyeOff size={16} /> : <Eye size={16} />} {r.publishedAt ? "Unpublish" : "Publish"}
                </button>
                {canManage && (
                  <button type="button" className={`${btn} text-red-700 dark:text-red-300`} disabled={busy} onClick={() => window.confirm("Delete this report and its file?") && run(deleteReport(r.id), { success: "Report deleted", error: "Couldn't delete the report" })}>
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
