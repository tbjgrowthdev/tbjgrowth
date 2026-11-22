import Link from "next/link";
import { Plus, ChevronRight, Send, Clock } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import { listClientsForAdmin, getClientsViewer } from "@/app/(admin)/actions/clients";
import { listStaleProjects, getUpdateReminderSettings } from "@/app/(admin)/actions/client-projects";
import UpdateReminderSetting from "@/components/Admin/Clients/UpdateReminderSetting";

// Clients overview: one card per client company. Built for a phone first
// (TBJ Admin app): cards, not a wide table.
export default async function ClientsPage() {
  const [clients, viewer, stale, settings] = await Promise.all([listClientsForAdmin(), getClientsViewer(), listStaleProjects(), getUpdateReminderSettings()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Clients</PageTitle>
        <div className="flex flex-wrap gap-2">
        {viewer.canUpdate && (
          <Link href="/admin/clients/update" className="inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-background transition-colors">
            <Send size={18} /> Post an update
          </Link>
        )}
        {viewer.canManage && (
          <Link href="/admin/clients/new" className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors">
            <Plus size={18} /> New client
          </Link>
        )}
        </div>
      </div>

      <section className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Clock size={18} /> Projects needing an update
        </h2>
        {settings?.updateReminderDays === 0 && <p className="text-sm text-caption">Reminders are off by default; only projects with their own interval are checked.</p>}
        {stale.length === 0 ? (
          <p className="text-sm text-caption">Every active project has a recent update.</p>
        ) : (
          <ul className="divide-y divide-border">
            {stale.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/clients/update?project=${p.id}`} className="flex min-h-11 items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground break-words">{p.clientName}: {p.title}</p>
                    <p className="text-sm text-caption">
                      {p.lastUpdateAt ? `Last update ${new Date(p.lastUpdateAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : "No updates yet"} · every {p.intervalDays} days
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-caption" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {viewer.canManage && settings && (
          <div className="border-t border-border pt-3">
            <UpdateReminderSetting days={settings.updateReminderDays} />
          </div>
        )}
      </section>

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
