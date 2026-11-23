import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { fill, formatDate, portalStrings } from "@/lib/portal/strings";
import { listProjects } from "@/lib/portal/data";
import StatusChip, { ProgressBar } from "@/components/Portal/StatusChip";

export default async function PortalProjectsPage() {
  const ctx = await requireClientPage();
  const t = portalStrings(ctx.language);
  const projects = await listProjects(ctx);

  return (
    <div className="space-y-4">
      <h1 className="admin-title text-2xl">{t.projects.title}</h1>
      {projects.length === 0 ? (
        <p className="admin-card p-6 text-center text-sm text-muted">{t.projects.empty}</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/projects/${p.id}`} className="admin-card block space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold break-words">{p.title}</h2>
                  <ChevronRight size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={p.status} labels={t.status} />
                  {p.dueDate && <span className="text-sm text-muted">{fill(t.projects.due, { date: formatDate(p.dueDate, ctx.language) })}</span>}
                </div>
                <ProgressBar value={p.progress} label={fill(t.projects.progress, { n: String(p.progress) })} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
