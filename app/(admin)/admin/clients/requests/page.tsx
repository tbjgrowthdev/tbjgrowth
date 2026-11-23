import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import RequestStatusButton from "@/components/Admin/Clients/RequestStatusButton";
import { getClientInbox } from "@/app/(admin)/actions/client-requests";

const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "");

// Staff inbox: requests sent from the portal and account-deletion requests.
// Deleting an account is a manual staff step in v1: disable the user on the
// client page, then remove their data as agreed with the client.
export default async function ClientInboxPage() {
  const { requests, deletionRequests } = await getClientInbox();
  const open = requests.filter((r) => r.status === "OPEN");
  const done = requests.filter((r) => r.status === "DONE");

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/admin/clients" className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> Clients
      </Link>
      <PageTitle>Client inbox</PageTitle>

      {deletionRequests.length > 0 && (
        <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-red-300 dark:border-red-900 space-y-3">
          <h2 className="text-lg font-bold text-foreground">Account deletion requests</h2>
          <ul className="divide-y divide-border">
            {deletionRequests.map((d) => (
              <li key={d.id} className="py-3">
                <p className="font-medium text-foreground break-words">{d.name} · {d.clientName}</p>
                <p className="text-sm text-caption break-all">{d.email} · asked {when(d.requestedAt)} · user is {d.status.toLowerCase()}</p>
                <Link href={`/admin/clients/${d.clientId}`} className="inline-flex min-h-11 items-center text-sm text-brand-orange-deep dark:text-brand-orange-light">Open client</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {[{ title: "Open requests", rows: open, empty: "Nothing open." }, { title: "Done", rows: done, empty: "Nothing yet." }].map((group) => (
        <section key={group.title} className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
          <h2 className="text-lg font-bold text-foreground">{group.title}</h2>
          {group.rows.length === 0 && <p className="text-sm text-caption">{group.empty}</p>}
          <ul className="divide-y divide-border">
            {group.rows.map((r) => (
              <li key={r.id} className="py-3 space-y-2">
                <p className="text-sm text-caption break-words">
                  <Link href={`/admin/clients/${r.clientId}`} className="font-semibold text-foreground hover:underline">{r.clientName}</Link> · {r.userName} ({r.userEmail}) · {when(r.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words text-foreground">{r.message}</p>
                <RequestStatusButton id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
