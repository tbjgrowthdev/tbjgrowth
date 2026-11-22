"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addMilestone, setMilestoneDone, deleteMilestone } from "@/app/(admin)/actions/client-projects";
import { withToast } from "@/lib/admin/toast";

type Milestone = { id: string; title: string; dueDate: Date | string | null; doneAt: Date | string | null };

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { dateStyle: "medium" }) : null);

/** Milestones of a project. Ticking one posts a "Milestone completed" update for the client. */
export default function ProjectMilestones({ projectId, milestones, canManage }: { projectId: string; milestones: Milestone[]; canManage: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(p: Promise<{ success: boolean }>, messages: { success: string; error: string }) {
    setBusy(true);
    try {
      const r = await withToast(p, messages);
      router.refresh();
      return r.success;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
      <h2 className="text-lg font-bold text-foreground">Milestones</h2>
      {milestones.length === 0 && <p className="text-caption text-sm">No milestones yet.</p>}
      <ul className="divide-y divide-border">
        {milestones.map((m) => (
          <li key={m.id} className="flex min-h-11 items-center gap-3 py-2">
            <input
              type="checkbox"
              aria-label={`Mark "${m.title}" done`}
              checked={!!m.doneAt}
              disabled={!canManage || busy}
              onChange={(e) => run(setMilestoneDone(m.id, e.target.checked), { success: e.target.checked ? "Milestone done, client updated" : "Milestone reopened", error: "Couldn't update the milestone" })}
              className="h-5 w-5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className={`break-words ${m.doneAt ? "line-through text-caption" : "text-foreground"}`}>{m.title}</p>
              {(m.dueDate || m.doneAt) && <p className="text-xs text-caption">{m.doneAt ? `Done ${day(m.doneAt)}` : `Due ${day(m.dueDate)}`}</p>}
            </div>
            {canManage && (
              <button type="button" aria-label={`Delete "${m.title}"`} disabled={busy} onClick={() => window.confirm("Delete this milestone?") && run(deleteMilestone(m.id), { success: "Milestone deleted", error: "Couldn't delete the milestone" })} className="inline-flex h-11 w-11 items-center justify-center text-caption hover:text-red-700">
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(addMilestone(projectId, { title, dueDate: due || null }), { success: "Milestone added", error: "Couldn't add the milestone" })) {
              setTitle("");
              setDue("");
            }
          }}
        >
          <input aria-label="Milestone title" required maxLength={200} placeholder="New milestone" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
          <input aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-background disabled:opacity-50">
            <Plus size={16} /> Add
          </button>
        </form>
      )}
    </section>
  );
}
