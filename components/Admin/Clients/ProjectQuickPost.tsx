"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, AlertCircle } from "lucide-react";
import { postProjectUpdate } from "@/app/(admin)/actions/client-projects";
import { withToast } from "@/lib/admin/toast";

type Template = { id: string; en: string; bn: string };
type ProjectOption = { id: string; title: string; clientName?: string };

const STATUS_LABEL = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", WAITING_ON_CLIENT: "Waiting on client", COMPLETED: "Completed" } as const;
type Status = keyof typeof STATUS_LABEL;

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";

/**
 * The quick-post form. Meant to take under 30 seconds on a phone: pick a
 * template (or type), optionally change the status, post. "Notify client" is
 * on by default. With `projects`, it shows a project picker first.
 */
export default function ProjectQuickPost({
  projectId,
  projects,
  templates,
  defaultLanguage = "en",
}: {
  projectId?: string;
  projects?: ProjectOption[];
  templates: readonly Template[];
  defaultLanguage?: "en" | "bn";
}) {
  const router = useRouter();
  const [target, setTarget] = useState(projectId ?? projects?.[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [lang, setLang] = useState<"en" | "bn">(defaultLanguage);
  const [status, setStatus] = useState<"" | Status>("");
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return setError("Pick a project first");
    setBusy(true);
    setError(null);
    try {
      const result = await withToast(postProjectUpdate(target, { body, internalNote: note || null, status: status || undefined, notify }), {
        success: notify ? "Update posted, client notified" : "Update posted",
        error: "Couldn't post the update",
      });
      if (!result.success) return setError(result.error);
      setBody("");
      setNote("");
      setStatus("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-3">
      <h2 className="text-lg font-bold text-foreground">Post an update</h2>
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}
      {projects && (
        <div>
          <label htmlFor="qp-project" className="block text-sm font-medium text-muted mb-1">Project</label>
          <select id="qp-project" value={target} onChange={(e) => setTarget(e.target.value)} className={input}>
            {projects.length === 0 && <option value="">No open projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.clientName ? `${p.clientName}: ${p.title}` : p.title}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2" aria-label="Templates">
        {templates.map((t) => (
          <button key={t.id} type="button" onClick={() => setBody(t[lang])} className="min-h-11 rounded-full border border-border px-3 py-1 text-sm hover:border-brand-orange">
            {t[lang]}
          </button>
        ))}
        <button type="button" onClick={() => setLang(lang === "en" ? "bn" : "en")} className="min-h-11 px-2 text-sm text-caption underline">
          {lang === "en" ? "বাংলা" : "English"}
        </button>
      </div>
      <div>
        <label htmlFor="qp-body" className="block text-sm font-medium text-muted mb-1">Update (the client sees this)</label>
        <textarea id="qp-body" required rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} className={`${input} py-2`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="qp-status" className="block text-sm font-medium text-muted mb-1">Change status (optional)</label>
          <select id="qp-status" value={status} onChange={(e) => setStatus(e.target.value as "" | Status)} className={input}>
            <option value="">Keep as is</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-5 w-5" />
          Notify client
        </label>
      </div>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-caption">Internal note (staff only)</summary>
        <textarea aria-label="Internal note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={`${input} py-2`} />
      </details>
      <button type="submit" disabled={busy} className="flex w-full min-h-11 items-center justify-center gap-2 px-5 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 sm:w-auto">
        <Send size={18} /> {busy ? "Posting…" : "Post update"}
      </button>
    </form>
  );
}
