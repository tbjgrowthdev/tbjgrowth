import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { formatPeriod, portalStrings } from "@/lib/portal/strings";
import { listReports } from "@/lib/portal/data";

// Published reports, newest month first. Drafts never reach this list (data.ts).
export default async function PortalReportsPage() {
  const ctx = await requireClientPage();
  const t = portalStrings(ctx.language).reports;
  const reports = await listReports(ctx);
  return (
    <div className="space-y-4">
      <h1 className="admin-title text-2xl">{t.title}</h1>
      {reports.length === 0 ? (
        <p className="admin-card p-6 text-center text-sm text-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link href={`/portal/reports/${r.id}`} className="admin-card flex min-h-11 items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-muted">{formatPeriod(r.period, ctx.language)}</p>
                  <p className="font-bold break-words">{r.title}</p>
                  {r.project && <p className="text-sm text-muted break-words">{r.project.title}</p>}
                </div>
                <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
