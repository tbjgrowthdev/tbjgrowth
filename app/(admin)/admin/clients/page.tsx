import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import { listClientsForAdmin, getClientsViewer } from "@/app/(admin)/actions/clients";

// Clients overview: one card per client company. Built for a phone first
// (TBJ Admin app): cards, not a wide table.
export default async function ClientsPage() {
  const [clients, viewer] = await Promise.all([listClientsForAdmin(), getClientsViewer()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Clients</PageTitle>
        {viewer.canManage && (
          <Link href="/admin/clients/new" className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors">
            <Plus size={18} /> New client
          </Link>
        )}
      </div>

      {clients.length === 0 ? (
        <p className="bg-card rounded-xl border border-border p-6 text-center text-caption">
          No clients yet.{viewer.canManage ? " Create one, then add a user to send their portal invite." : ""}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clients/${c.id}`} className="flex min-h-11 items-center justify-between gap-3 bg-card rounded-xl border border-border p-4 hover:border-brand-orange transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground break-words">{c.name}</p>
                  <p className="text-sm text-caption">
                    {c._count.users} {c._count.users === 1 ? "user" : "users"} · {c._count.projects} {c._count.projects === 1 ? "project" : "projects"}
                    {c.accountManager ? ` · ${c.accountManager.name}` : ""}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-caption" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
