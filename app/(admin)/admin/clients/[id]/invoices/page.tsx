import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import InvoicesManager from "@/components/Admin/Clients/InvoicesManager";
import { getClientForAdmin, getClientsViewer } from "@/app/(admin)/actions/clients";
import { listInvoicesForAdmin } from "@/app/(admin)/actions/client-files";

export default async function ClientInvoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getClientsViewer();
  if (!viewer.canManage) redirect(`/admin/clients/${id}`);
  const [client, invoices] = await Promise.all([getClientForAdmin(id), listInvoicesForAdmin(id)]);
  if (!client) notFound();
  return (
    <div className="space-y-6 max-w-4xl">
      <Link href={`/admin/clients/${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> {client.name}
      </Link>
      <PageTitle>Invoices</PageTitle>
      <InvoicesManager clientId={id} invoices={invoices} />
    </div>
  );
}
