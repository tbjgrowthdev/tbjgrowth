import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import ClientForm from "@/components/Admin/Clients/ClientForm";
import ClientUsersPanel from "@/components/Admin/Clients/ClientUsersPanel";
import { getClientForAdmin, getClientsViewer, listAccountManagerOptions } from "@/app/(admin)/actions/clients";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, viewer] = await Promise.all([getClientForAdmin(id), getClientsViewer()]);
  if (!client) notFound();
  const managers = viewer.canManage ? await listAccountManagerOptions() : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/clients" className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> All clients
      </Link>
      <PageTitle>{client.name}</PageTitle>

      {viewer.canManage ? (
        <ClientForm initial={client} managers={managers} />
      ) : (
        <section className="bg-card p-4 sm:p-6 rounded-xl border border-border text-sm space-y-1">
          <p><span className="text-caption">Account manager:</span> {client.accountManager?.name ?? "None"}</p>
          {client.whatsapp && <p><span className="text-caption">WhatsApp:</span> {client.whatsapp}</p>}
          {client.phone && <p><span className="text-caption">Phone:</span> {client.phone}</p>}
        </section>
      )}

      <ClientUsersPanel clientId={client.id} users={client.users} canManage={viewer.canManage} />
    </div>
  );
}
