"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, AlertCircle } from "lucide-react";
import { createProject, updateProject, deleteProject } from "@/app/(admin)/actions/client-projects";
import { withToast } from "@/lib/admin/toast";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "COMPLETED";
type Initial = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  progress: number;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  updateIntervalDays: number | null;
};

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const label = "block text-sm font-medium text-muted mb-1";
const dateValue = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** Create or edit a project (CLIENT_MANAGEMENT). Empty reminder interval = use the default. */
export default function ProjectForm({ clientId, initial, defaultIntervalDays }: { clientId: string; initial?: Initial; defaultIntervalDays: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: (initial?.status ?? "NOT_STARTED") as Status,
    progress: String(initial?.progress ?? 0),
    startDate: dateValue(initial?.startDate ?? null),
    dueDate: dateValue(initial?.dueDate ?? null),
    interval: initial?.updateIntervalDays == null ? "" : String(initial.updateIntervalDays),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = {
        title: f.title,
        description: f.description,
        status: f.status,
        progress: Number(f.progress),
        startDate: f.startDate || null,
        dueDate: f.dueDate || null,
        updateIntervalDays: f.interval === "" ? null : Number(f.interval),
      };
      if (!initial) {
        const r = await withToast(createProject(clientId, data), { success: "Project created", error: "Couldn't create the project" });
        if (!r.success) return setError(r.error);
        router.push(`/admin/clients/${clientId}/projects/${r.id}`);
        return;
      }
      const r = await withToast(updateProject(initial.id, data), { success: "Project saved", error: "Couldn't save the project" });
      if (!r.success) return setError(r.error);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!initial || !window.confirm("Delete this project with its milestones, updates and approvals? This can't be undone.")) return;
    const r = await withToast(deleteProject(initial.id), { success: "Project deleted", error: "Couldn't delete the project" });
    if (r.success) router.push(`/admin/clients/${clientId}`);
    else setError(r.error);
  }

  return (
    <form onSubmit={submit} className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4">
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      <div>
        <label htmlFor="pf-title" className={label}>Title</label>
        <input id="pf-title" required maxLength={200} value={f.title} onChange={set("title")} className={input} />
      </div>
      <div>
        <label htmlFor="pf-desc" className={label}>Description (the client sees this)</label>
        <textarea id="pf-desc" rows={3} maxLength={5000} value={f.description} onChange={set("description")} className={`${input} py-2`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pf-status" className={label}>Status</label>
          <select id="pf-status" value={f.status} onChange={set("status")} className={input}>
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="WAITING_ON_CLIENT">Waiting on client</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div>
          <label htmlFor="pf-progress" className={label}>Progress (%)</label>
          <input id="pf-progress" type="number" inputMode="numeric" min={0} max={100} value={f.progress} onChange={set("progress")} className={input} />
        </div>
        <div>
          <label htmlFor="pf-start" className={label}>Start date</label>
          <input id="pf-start" type="date" value={f.startDate} onChange={set("startDate")} className={input} />
        </div>
        <div>
          <label htmlFor="pf-due" className={label}>Due date</label>
          <input id="pf-due" type="date" value={f.dueDate} onChange={set("dueDate")} className={input} />
        </div>
      </div>
      <div>
        <label htmlFor="pf-interval" className={label}>Update reminder (days)</label>
        <input id="pf-interval" type="number" inputMode="numeric" min={0} max={60} placeholder={`Default (${defaultIntervalDays})`} value={f.interval} onChange={set("interval")} className={input} />
        <p className="mt-1 text-xs text-caption">Empty uses the default. 0 turns reminders off for this project.</p>
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        {initial ? (
          <button type="button" onClick={remove} className="inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            <Trash2 size={16} /> Delete project
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={busy} className="flex min-h-11 items-center gap-2 px-5 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50">
          <Save size={18} /> {busy ? "Saving…" : initial ? "Save project" : "Create project"}
        </button>
      </div>
    </form>
  );
}
