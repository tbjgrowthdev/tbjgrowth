import { notFound, redirect } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";
import ProjectForm from "@/components/Admin/Clients/ProjectForm";
import { getClientForAdmin, getClientsViewer } from "@/app/(admin)/actions/clients";
import { getUpdateReminderSettings } from "@/app/(admin)/actions/client-projects";

export default async function NewProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getClientsViewer();
  if (!viewer.canManage) redirect(`/admin/clients/${id}`);
  const [client, settings] = await Promise.all([getClientForAdmin(id), getUpdateReminderSettings()]);
  if (!client) notFound();
  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle>New project for {client.name}</PageTitle>
      <ProjectForm clientId={client.id} defaultIntervalDays={settings?.updateReminderDays ?? 7} />
    </div>
  );
}
