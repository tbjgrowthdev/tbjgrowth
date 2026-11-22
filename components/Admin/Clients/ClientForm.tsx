"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle } from "lucide-react";
import { createClient, updateClient, assignAccountManager } from "@/app/(admin)/actions/clients";
import { withToast } from "@/lib/admin/toast";

type Manager = { id: string; name: string | null; email: string | null };
type Initial = { id: string; name: string; whatsapp: string | null; phone: string | null; notes: string | null; accountManagerId: string | null };

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const label = "block text-sm font-medium text-muted mb-1";

/** Create or edit a client company. Mobile-first: one column, 44px controls, 16px inputs. */
export default function ClientForm({ initial, managers }: { initial?: Initial; managers: Manager[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    whatsapp: initial?.whatsapp ?? "",
    phone: initial?.phone ?? "",
    notes: initial?.notes ?? "",
    accountManagerId: initial?.accountManagerId ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fields = { name: form.name, whatsapp: form.whatsapp, phone: form.phone, notes: form.notes };
      if (!initial) {
        const result = await withToast(createClient({ ...fields, accountManagerId: form.accountManagerId || null }), { success: "Client created", error: "Couldn't create the client" });
        if (!result.success) return setError(result.error);
        router.push(`/admin/clients/${result.id}`);
        return;
      }
      const result = await withToast(updateClient(initial.id, fields), { success: "Client saved", error: "Couldn't save the client" });
      if (!result.success) return setError(result.error);
      if ((form.accountManagerId || null) !== initial.accountManagerId) {
        const r = await assignAccountManager(initial.id, form.accountManagerId || null);
        if (!r.success) return setError(r.error);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      <div>
        <label htmlFor="client-name" className={label}>Company name</label>
        <input id="client-name" required maxLength={200} value={form.name} onChange={set("name")} className={input} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="client-whatsapp" className={label}>WhatsApp (shown to the client as &quot;contact us&quot;)</label>
          <input id="client-whatsapp" type="tel" maxLength={40} value={form.whatsapp} onChange={set("whatsapp")} className={input} placeholder="+8801…" />
        </div>
        <div>
          <label htmlFor="client-phone" className={label}>Phone</label>
          <input id="client-phone" type="tel" maxLength={40} value={form.phone} onChange={set("phone")} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="client-manager" className={label}>Account manager</label>
        <select id="client-manager" value={form.accountManagerId} onChange={set("accountManagerId")} className={input}>
          <option value="">None</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name || m.email || m.id}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="client-notes" className={label}>Staff notes (never shown to the client)</label>
        <textarea id="client-notes" rows={3} maxLength={5000} value={form.notes} onChange={set("notes")} className={`${input} py-2`} />
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className="flex min-h-11 items-center gap-2 px-5 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50">
          <Save size={18} /> {busy ? "Saving…" : initial ? "Save client" : "Create client"}
        </button>
      </div>
    </form>
  );
}
