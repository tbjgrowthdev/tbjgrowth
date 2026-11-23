"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Trash2, AlertCircle } from "lucide-react";
import { createInvoice, setInvoiceStatus, deleteInvoice } from "@/app/(admin)/actions/client-files";
import { withToast } from "@/lib/admin/toast";

type Status = "DUE" | "PAID" | "OVERDUE" | "VOID";
type InvoiceRow = { id: string; number: string; amountMinor: number; currency: string; status: Status; issueDate: Date | string; dueDate: Date | string; fileKey: string | null };

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const label = "block text-sm font-medium text-muted mb-1";
const btn = "inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background disabled:opacity-50";
const today = () => new Date().toISOString().slice(0, 10);
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const day = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { dateStyle: "medium" });

/** Invoices (CLIENT_MANAGEMENT only). No payment processing: status is set by staff. */
export default function InvoicesManager({ clientId, invoices }: { clientId: string; invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T extends { success: boolean; error?: string }>(p: Promise<T>, messages: { success: string; error: string }) {
    setBusy(true);
    setError(null);
    try {
      const r = await withToast(p, messages);
      if (!r.success) setError(r.error ?? messages.error);
      router.refresh();
      return r.success;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      <form
        className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          fd.set("clientId", clientId);
          if (await run(createInvoice(fd), { success: "Invoice saved", error: "Couldn't save the invoice" })) form.reset();
        }}
      >
        <h2 className="text-lg font-bold text-foreground">New invoice</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="inv-number" className={label}>Invoice number</label>
            <input id="inv-number" name="number" required maxLength={60} className={input} />
          </div>
          <div>
            <label htmlFor="inv-amount" className={label}>Amount</label>
            <input id="inv-amount" name="amount" required inputMode="decimal" pattern="[0-9,]+(\.[0-9]{1,2})?" placeholder="15000.00" className={input} />
          </div>
          <div>
            <label htmlFor="inv-currency" className={label}>Currency</label>
            <select id="inv-currency" name="currency" defaultValue="BDT" className={input}>
              <option value="BDT">BDT</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div>
            <label htmlFor="inv-issue" className={label}>Issue date</label>
            <input id="inv-issue" name="issueDate" type="date" required defaultValue={today()} className={input} />
          </div>
          <div>
            <label htmlFor="inv-due" className={label}>Due date</label>
            <input id="inv-due" name="dueDate" type="date" required className={input} />
          </div>
          <div>
            <label htmlFor="inv-status" className={label}>Status</label>
            <select id="inv-status" name="status" defaultValue="DUE" className={input}>
              <option value="DUE">Due (client is notified)</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="inv-file" className={label}>Invoice file (optional: PDF, PNG or JPG, up to 20 MB)</label>
          <input id="inv-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="block w-full min-h-11 text-base" />
        </div>
        <button type="submit" disabled={busy} className="flex min-h-11 items-center gap-2 px-5 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
          <Plus size={18} /> {busy ? "Saving…" : "Save invoice"}
        </button>
      </form>

      <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
        <h2 className="text-lg font-bold text-foreground">Invoices</h2>
        {invoices.length === 0 && <p className="text-sm text-caption">No invoices yet.</p>}
        <ul className="divide-y divide-border">
          {invoices.map((i) => (
            <li key={i.id} className="py-3 space-y-2">
              <div>
                <p className="font-medium text-foreground break-words">{i.number} · {money(i.amountMinor, i.currency)}</p>
                <p className="text-sm text-caption">Issued {day(i.issueDate)} · due {day(i.dueDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label={`Status of ${i.number}`} value={i.status} disabled={busy} onChange={(e) => run(setInvoiceStatus(i.id, e.target.value as Status), { success: "Status changed", error: "Couldn't change the status" })} className="min-h-11 rounded-lg border border-border bg-background px-3 text-base">
                  <option value="DUE">Due</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="VOID">Void (hidden from client)</option>
                </select>
                {i.fileKey && (
                  <a href={`/api/admin/client-files/${i.id}?kind=invoice`} className={btn}>
                    <Download size={16} /> File
                  </a>
                )}
                <button type="button" className={`${btn} text-red-700 dark:text-red-300`} disabled={busy} onClick={() => window.confirm("Delete this invoice and its file?") && run(deleteInvoice(i.id), { success: "Invoice deleted", error: "Couldn't delete the invoice" })}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
