import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Send, ChevronRight, FileBarChart, Receipt } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import ClientForm from "@/components/Admin/Clients/ClientForm";
import ClientUsersPanel from "@/components/Admin/Clients/ClientUsersPanel";
import { getClientForAdmin, getClientsViewer, listAccountManagerOptions } from "@/app/(admin)/actions/clients";
import { listProjectsForAdmin } from "@/app/(admin)/actions/client-projects";

const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", WAITING_ON_CLIENT: "Waiting on client", COMPLETED: "Completed" } as const;

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, viewer, projects] = await Promise.all([getClientForAdmin(id), getClientsViewer(), listProjectsForAdmin(id)]);
  if (!client) notFound();
  const managers = viewer.canManage ? await listAccountManagerOptions() : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/clients" className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> All clients
      </Link>
      <PageTitle>{client.name}</PageTitle>
      <nav className="flex flex-wrap gap-2" aria-label="Client sections">
        <Link href={`/admin/clients/${client.id}/reports`} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background">
          <FileBarChart size={16} /> Reports
        </Link>
        {viewer.canManage && (
          <Link href={`/admin/clients/${client.id}/invoices`} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background">
            <Receipt size={16} /> Invoices
          </Link>
        )}
      </nav>

      {viewer.canManage ? (
        <ClientForm initial={client} managers={managers} />
      ) : (
        <section className="bg-card p-4 sm:p-6 rounded-xl border border-border text-sm space-y-1">
          <p><span className="text-caption">Account manager:</span> {client.accountManager?.name ?? "None"}</p>
          {client.whatsapp && <p><span className="text-caption">WhatsApp:</span> {client.whatsapp}</p>}
          {client.phone && <p><span className="text-caption">Phone:</span> {client.phone}</p>}
        </section>
      )}

      <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">Projects</h2>
          {viewer.canManage && (
            <Link href={`/admin/clients/${client.id}/projects/new`} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background">
              <Plus size={16} /> New project
            </Link>
          )}
        </div>
        {projects.length === 0 && <p className="text-sm text-caption">No projects yet.</p>}
        <ul className="divide-y divide-border">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/clients/${client.id}/projects/${p.id}`} className="flex min-h-11 items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">{p.title}</p>
                  <p className="text-sm text-caption">
                    {STATUS_LABEL[p.status]} · {p.progress}%{p.updates[0] ? ` · last update ${new Date(p.updates[0].createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : " · no updates yet"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-orange-deep dark:text-brand-orange-light">
                  <Send size={14} /> Update <ChevronRight size={16} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ClientUsersPanel clientId={client.id} users={client.users} canManage={viewer.canManage} />
    </div>
  );
}
