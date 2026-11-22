import { redirect } from "next/navigation";
import PageTitle from "@/components/Admin/PageTitle";
import ClientForm from "@/components/Admin/Clients/ClientForm";
import { getClientsViewer, listAccountManagerOptions } from "@/app/(admin)/actions/clients";

export default async function NewClientPage() {
  const viewer = await getClientsViewer();
  if (!viewer.canManage) redirect("/admin/clients");
  const managers = await listAccountManagerOptions();
  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle>New client</PageTitle>
      <ClientForm managers={managers} />
    </div>
  );
}
