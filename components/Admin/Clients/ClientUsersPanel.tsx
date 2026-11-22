"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Send, Ban, CheckCircle2, LogOut, AlertCircle } from "lucide-react";
import { addClientUser, resendInvite, setClientUserDisabled, revokeClientUserSessions } from "@/app/(admin)/actions/clients";
import { withToast } from "@/lib/admin/toast";

type ClientUserRow = {
  id: string;
  email: string;
  name: string;
  language: "en" | "bn";
  status: "INVITED" | "ACTIVE" | "DISABLED";
  lastLoginAt: Date | string | null;
  deletionRequestedAt: Date | string | null;
};

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const btn = "inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background disabled:opacity-50";

const STATUS_STYLE: Record<ClientUserRow["status"], string> = {
  INVITED: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  DISABLED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
};

const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");

/** Portal users of one client. Management buttons appear only for CLIENT_MANAGEMENT; the actions re-check. */
export default function ClientUsersPanel({ clientId, users, canManage }: { clientId: string; users: ClientUserRow[]; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", name: "", language: "en" as "en" | "bn" });

  async function run(key: string, action: Promise<{ success: boolean; error?: string }>, messages: { success: string; error: string }) {
    setBusy(key);
    setError(null);
    try {
      const result = await withToast(action, messages);
      if (!result.success) setError(result.error ?? messages.error);
      router.refresh();
      return result.success;
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run("add", addClientUser(clientId, form), { success: "Invite sent", error: "Couldn't add the user" });
    if (ok) setForm({ email: "", name: "", language: "en" });
  }

  return (
    <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4">
      <h2 className="text-lg font-bold text-foreground">Portal users</h2>
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {users.length === 0 ? (
        <p className="text-caption">No one at this client can sign in yet. Add a user to send an invite.</p>
      ) : (
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground break-words">
                  {u.name} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[u.status]}`}>{u.status.toLowerCase()}</span>
                </p>
                <p className="text-sm text-caption break-all">{u.email} · {u.language === "bn" ? "বাংলা" : "English"}</p>
                <p className="text-xs text-caption">Last sign-in: {when(u.lastLoginAt)}</p>
                {u.deletionRequestedAt && <p className="text-xs font-semibold text-red-700 dark:text-red-300">Asked for account deletion on {when(u.deletionRequestedAt)}</p>}
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {u.status !== "DISABLED" && (
                    <button type="button" className={btn} disabled={busy !== null} onClick={() => run(`resend-${u.id}`, resendInvite(u.id), { success: "Invite sent", error: "Couldn't send the invite" })}>
                      <Send size={16} /> {u.status === "INVITED" ? "Resend invite" : "Send code"}
                    </button>
                  )}
                  {u.status !== "DISABLED" && (
                    <button type="button" className={btn} disabled={busy !== null} onClick={() => run(`revoke-${u.id}`, revokeClientUserSessions(u.id), { success: "Signed out on all devices", error: "Couldn't sign the user out" })}>
                      <LogOut size={16} /> Sign out everywhere
                    </button>
                  )}
                  {u.status === "DISABLED" ? (
                    <button type="button" className={btn} disabled={busy !== null} onClick={() => run(`enable-${u.id}`, setClientUserDisabled(u.id, false), { success: "User enabled", error: "Couldn't enable the user" })}>
                      <CheckCircle2 size={16} /> Enable
                    </button>
                  ) : (
                    <button type="button" className={`${btn} text-red-700 dark:text-red-300`} disabled={busy !== null} onClick={() => run(`disable-${u.id}`, setClientUserDisabled(u.id, true), { success: "User disabled", error: "Couldn't disable the user" })}>
                      <Ban size={16} /> Disable
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={add} className="border-t border-border pt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="cu-name" className="block text-sm font-medium text-muted mb-1">Name</label>
            <input id="cu-name" required maxLength={200} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          </div>
          <div>
            <label htmlFor="cu-email" className="block text-sm font-medium text-muted mb-1">Email</label>
            <input id="cu-email" type="email" required maxLength={254} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={input} />
          </div>
          <div>
            <label htmlFor="cu-lang" className="block text-sm font-medium text-muted mb-1">Language</label>
            <select id="cu-lang" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as "en" | "bn" }))} className={input}>
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
          </div>
          <button type="submit" disabled={busy !== null} className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
            <UserPlus size={18} /> {busy === "add" ? "Sending…" : "Add and invite"}
          </button>
        </form>
      )}
    </section>
  );
}
