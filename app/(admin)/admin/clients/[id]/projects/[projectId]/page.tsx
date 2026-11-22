import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import ProjectQuickPost from "@/components/Admin/Clients/ProjectQuickPost";
import ProjectForm from "@/components/Admin/Clients/ProjectForm";
import ProjectMilestones from "@/components/Admin/Clients/ProjectMilestones";
import ApprovalRequestForm from "@/components/Admin/Clients/ApprovalRequestForm";
import { getClientsViewer } from "@/app/(admin)/actions/clients";
import { getProjectForAdmin, getUpdateReminderSettings } from "@/app/(admin)/actions/client-projects";
import { UPDATE_TEMPLATES } from "@/lib/clients/updates";

const when = (d: Date | string) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const APPROVAL_LABEL = { PENDING: "Waiting for the client", APPROVED: "Approved", CHANGES_REQUESTED: "Changes requested" } as const;

export default async function ProjectAdminPage({ params }: { params: Promise<{ id: string; projectId: string }> }) {
  const { id, projectId } = await params;
  const [project, viewer, settings] = await Promise.all([getProjectForAdmin(projectId), getClientsViewer(), getUpdateReminderSettings()]);
  // The URL's client must be the project's client.
  if (!project || project.clientId !== id) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> {project.client.name}
      </Link>
      <PageTitle>{project.title}</PageTitle>

      <ProjectQuickPost projectId={project.id} templates={UPDATE_TEMPLATES} />

      <ProjectMilestones projectId={project.id} milestones={project.milestones} canManage={viewer.canManage} />

      <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
        <h2 className="text-lg font-bold text-foreground">Approvals</h2>
        {project.approvals.length === 0 && <p className="text-sm text-caption">No approval requests yet.</p>}
        <ul className="divide-y divide-border">
          {project.approvals.map((a) => (
            <li key={a.id} className="py-2">
              <p className="font-medium text-foreground break-words">{a.title}</p>
              <p className="text-sm text-caption">
                {APPROVAL_LABEL[a.status]} · asked {when(a.createdAt)}
                {a.respondedAt ? ` · answered ${when(a.respondedAt)}` : ""}
              </p>
              {a.response && <p className="mt-1 text-sm whitespace-pre-wrap break-words">&ldquo;{a.response}&rdquo;</p>}
            </li>
          ))}
        </ul>
        {viewer.canManage && <ApprovalRequestForm projectId={project.id} />}
      </section>

      <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
        <h2 className="text-lg font-bold text-foreground">Updates</h2>
        {project.updates.length === 0 && <p className="text-sm text-caption">No updates yet. The client sees an empty feed until you post one.</p>}
        <ul className="divide-y divide-border">
          {project.updates.map((u) => (
            <li key={u.id} className="py-3">
              <p className="text-xs text-caption">
                {when(u.createdAt)} · {u.kind === "MANUAL" ? (u.author?.name ?? "Staff") : "Automatic"}
              </p>
              <p className="whitespace-pre-wrap break-words text-foreground">{u.body}</p>
              {u.internalNote && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Internal: {u.internalNote}</p>}
            </li>
          ))}
        </ul>
      </section>

      {viewer.canManage && (
        <details className="group">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-foreground">Edit project</summary>
          <ProjectForm clientId={id} initial={project} defaultIntervalDays={settings?.updateReminderDays ?? 7} />
        </details>
      )}
    </div>
  );
}
