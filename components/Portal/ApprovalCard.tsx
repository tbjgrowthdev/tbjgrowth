"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PencilLine } from "lucide-react";
import { respondToApproval } from "@/app/(portal)/actions/approvals";
import type { PortalStrings } from "@/lib/portal/strings";

type Approval = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED";
  response: string | null;
  projectTitle?: string;
};

/**
 * One approval request. Pending: big Approve / Request changes buttons
 * (asking for changes opens a comment box; a comment is required). Answered:
 * the answer and the client's comment. `answeredLabel` is the formatted
 * "Answered {date}" text from the server.
 */
export default function ApprovalCard({ approval, t, answeredLabel }: { approval: Approval; t: PortalStrings["approvals"]; answeredLabel?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "comment">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function answer(decision: "APPROVED" | "CHANGES_REQUESTED") {
    setBusy(true);
    setMessage(null);
    try {
      const r = await respondToApproval({ approvalId: approval.id, decision, comment: decision === "CHANGES_REQUESTED" ? comment : null });
      if (!r.success) {
        setMessage({ kind: "error", text: t.errors[r.error] });
        if (r.error === "signed_out") router.push("/portal/signout");
        return;
      }
      setMessage({ kind: "ok", text: t.thanks });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const answered = approval.status !== "PENDING";
  return (
    <article className="admin-card space-y-3 p-4">
      <div>
        {approval.projectTitle && <p className="text-xs font-semibold text-muted">{approval.projectTitle}</p>}
        <h3 className="text-base font-bold break-words">{approval.title}</h3>
        {approval.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{approval.description}</p>}
      </div>

      {answered ? (
        <div className="text-sm">
          <p className="font-semibold">{approval.status === "APPROVED" ? t.approved : t.changesRequested}</p>
          {answeredLabel && <p className="text-muted">{answeredLabel}</p>}
          {approval.response && (
            <p className="mt-1 whitespace-pre-wrap break-words">
              <span className="text-muted">{t.yourComment}: </span>
              {approval.response}
            </p>
          )}
        </div>
      ) : mode === "comment" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void answer("CHANGES_REQUESTED");
          }}
        >
          <label htmlFor={`comment-${approval.id}`} className="block text-sm font-semibold">{t.commentLabel}</label>
          <textarea id={`comment-${approval.id}`} required rows={3} maxLength={5000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.commentPlaceholder} className="w-full rounded-xl border border-border bg-[var(--card-bg)] px-4 py-3 text-base" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !comment.trim()} className="btn-primary min-h-11 flex-1 rounded-xl px-4 font-semibold disabled:opacity-50">{t.send}</button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className="min-h-11 rounded-xl border border-[var(--border-c)] px-4">{t.cancel}</button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => answer("APPROVED")} className="btn-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 font-semibold disabled:opacity-50">
            <Check size={18} aria-hidden="true" /> {t.approve}
          </button>
          <button type="button" disabled={busy} onClick={() => setMode("comment")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border-c)] px-3 font-semibold">
            <PencilLine size={18} aria-hidden="true" /> {t.requestChanges}
          </button>
        </div>
      )}

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
          {message.text}
        </p>
      )}
    </article>
  );
}
