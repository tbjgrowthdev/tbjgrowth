import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { fill, formatDate, portalStrings } from "@/lib/portal/strings";
import { getProject } from "@/lib/portal/data";
import StatusChip, { ProgressBar } from "@/components/Portal/StatusChip";
import MilestoneTimeline from "@/components/Portal/MilestoneTimeline";
import UpdateFeed from "@/components/Portal/UpdateFeed";
import ApprovalCard from "@/components/Portal/ApprovalCard";

// One project. getProject() is scoped to the session's client: another
// client's project id is a 404, exactly like one that doesn't exist.
export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireClientPage();
  const { id } = await params;
  const lang = ctx.language;
  const t = portalStrings(lang);
  const project = await getProject(ctx, id);
  if (!project) notFound();

  const pending = project.approvals.filter((a) => a.status === "PENDING");
  const answered = project.approvals.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6">
      <Link href="/portal/projects" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted">
        <ArrowLeft size={16} aria-hidden="true" /> {t.projects.back}
      </Link>

      <section className="admin-card space-y-3 p-4">
        <h1 className="admin-title text-2xl break-words">{project.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={project.status} labels={t.status} />
          {project.startDate && <span className="text-sm text-muted">{fill(t.projects.started, { date: formatDate(project.startDate, lang) })}</span>}
          {project.dueDate && <span className="text-sm text-muted">{fill(t.projects.due, { date: formatDate(project.dueDate, lang) })}</span>}
        </div>
        <ProgressBar value={project.progress} label={fill(t.projects.progress, { n: String(project.progress) })} />
        {project.description && <p className="whitespace-pre-wrap break-words text-sm">{project.description}</p>}
      </section>

      {pending.length > 0 && (
        <section className="space-y-3" aria-labelledby="pending">
          <h2 id="pending" className="text-lg font-bold">{t.home.waitingOnYou}</h2>
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} t={t.approvals} />
          ))}
        </section>
      )}

      <section className="admin-card space-y-3 p-4" aria-labelledby="milestones">
        <h2 id="milestones" className="text-lg font-bold">{t.projects.milestones}</h2>
        <MilestoneTimeline milestones={project.milestones} t={t.projects} language={lang} />
      </section>

      <section className="space-y-3" aria-labelledby="updates">
        <h2 id="updates" className="text-lg font-bold">{t.projects.updates}</h2>
        <UpdateFeed updates={project.updates} t={t.projects} language={lang} />
      </section>

      {answered.length > 0 && (
        <section className="space-y-3" aria-labelledby="answered">
          <h2 id="answered" className="text-lg font-bold">{t.projects.approvals}</h2>
          {answered.map((a) => (
            <ApprovalCard key={a.id} approval={a} t={t.approvals} answeredLabel={a.respondedAt ? fill(t.approvals.answeredOn, { date: formatDate(a.respondedAt, lang) }) : undefined} />
          ))}
        </section>
      )}
    </div>
  );
}
