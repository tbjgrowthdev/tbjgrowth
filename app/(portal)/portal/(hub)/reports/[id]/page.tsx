import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { formatPeriod, portalStrings } from "@/lib/portal/strings";
import { getReport } from "@/lib/portal/data";

type Metric = { label: string; value: string; change?: string };

// One report: summary, headline numbers as large tiles, then the PDF.
export default async function PortalReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const t = portalStrings(ctx.language).reports;
  const report = await getReport(ctx, id);
  if (!report) notFound();
  const metrics = (Array.isArray(report.metrics) ? report.metrics : []) as Metric[];

  return (
    <div className="space-y-5">
      <Link href="/portal/reports" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted">
        <ArrowLeft size={16} aria-hidden="true" /> {t.back}
      </Link>
      <header>
        <p className="text-sm font-semibold text-muted">{formatPeriod(report.period, ctx.language)}</p>
        <h1 className="admin-title text-2xl break-words">{report.title}</h1>
        {report.project && <p className="text-sm text-muted break-words">{report.project.title}</p>}
      </header>
      {report.summary && <p className="admin-card whitespace-pre-wrap break-words p-4">{report.summary}</p>}
      {metrics.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {metrics.map((m, i) => (
            <li key={i} className="admin-card p-4">
              <p className="text-sm text-muted break-words">{m.label}</p>
              <p className="text-2xl font-bold break-words">{m.value}</p>
              {m.change && <p className="text-sm font-semibold text-[var(--admin-orange-text)] break-words">{m.change}</p>}
            </li>
          ))}
        </ul>
      )}
      {report.hasFile && (
        <a href={`/api/portal/files/${report.id}?kind=report`} className="btn-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold">
          <Download size={18} aria-hidden="true" /> {t.download}
        </a>
      )}
    </div>
  );
}
