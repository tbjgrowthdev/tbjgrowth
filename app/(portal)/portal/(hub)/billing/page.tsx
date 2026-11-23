import { Download } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { fill, formatDate, formatMoney, portalStrings } from "@/lib/portal/strings";
import { listInvoices } from "@/lib/portal/data";

const STATUS_STYLE: Record<string, string> = {
  DUE: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  OVERDUE: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200",
  PAID: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
};

// Invoices (VOID ones are hidden by data.ts). No payments in this version.
export default async function PortalBillingPage() {
  const ctx = await requireClientPage();
  const lang = ctx.language;
  const t = portalStrings(lang).billing;
  const invoices = await listInvoices(ctx);
  return (
    <div className="space-y-4">
      <h1 className="admin-title text-2xl">{t.title}</h1>
      {invoices.length === 0 ? (
        <p className="admin-card p-6 text-center text-sm text-muted">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {invoices.map((i) => (
            <li key={i.id} className="admin-card space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-muted break-words">{i.number}</p>
                  <p className="text-xl font-bold">{formatMoney(i.amountMinor, i.currency, lang)}</p>
                </div>
                <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[i.status] ?? ""}`}>{t.status[i.status as keyof typeof t.status] ?? i.status}</span>
              </div>
              <p className="text-sm text-muted">
                {fill(t.issued, { date: formatDate(i.issueDate, lang) })} · {fill(t.due, { date: formatDate(i.dueDate, lang) })}
              </p>
              {i.hasFile && (
                <a href={`/api/portal/files/${i.id}?kind=invoice`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--admin-orange-text)]">
                  <Download size={16} aria-hidden="true" /> {t.download}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">{t.note}</p>
    </div>
  );
}
