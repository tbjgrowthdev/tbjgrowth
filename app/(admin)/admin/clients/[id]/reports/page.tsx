import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import ReportsManager from "@/components/Admin/Clients/ReportsManager";
import { getClientForAdmin, getClientsViewer } from "@/app/(admin)/actions/clients";
import { listProjectsForAdmin } from "@/app/(admin)/actions/client-projects";
import { listReportsForAdmin } from "@/app/(admin)/actions/client-files";

export default async function ClientReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, viewer, reports, projects] = await Promise.all([getClientForAdmin(id), getClientsViewer(), listReportsForAdmin(id), listProjectsForAdmin(id)]);
  if (!client) notFound();
  return (
    <div className="space-y-6 max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> {client.name}
      </Link>
      <PageTitle>Reports</PageTitle>
      <ReportsManager clientId={id} reports={reports} projects={projects.map((p) => ({ id: p.id, title: p.title }))} canManage={viewer.canManage} />
    </div>
  );
}
