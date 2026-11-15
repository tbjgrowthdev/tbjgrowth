"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reply, Send, X } from "lucide-react";
import { replyToLead } from "@/app/(admin)/actions/forms";
import { toast } from "@/lib/admin/toast";
import { describeActionError } from "@/lib/admin/action-errors";

const MAX_LENGTH = 10000;

/**
 * Reply box on each lead in /admin/leads. Collapsed to a button until opened.
 * `inbox` is the Site Settings email the lead's answer will go to; without
 * one, sending is blocked and the box says why.
 */
export default function LeadReplyBox({
  leadId,
  leadName,
  leadEmail,
  inbox,
  hasReplies,
}: {
  leadId: string;
  leadName: string;
  leadEmail: string;
  inbox: string | null;
  hasReplies: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const fieldId = `lead-reply-${leadId}`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange"
      >
        <Reply size={14} />
        {hasReplies ? "Reply again" : "Reply"}
      </button>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const result = await replyToLead({ leadId, body });
      if (!result.success) {
        toast.error("Reply not sent", { description: result.error });
        return;
      }
      if ("warning" in result && result.warning) toast.error("Reply sent, but not saved", { description: result.warning });
      else toast.success(`Reply sent to ${leadEmail}`);
      setBody("");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Reply not sent", { description: describeActionError(error, "The request failed") });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} className="w-full mt-2 space-y-2">
      <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
        Reply to {leadName} <span className="font-normal text-caption">&lt;{leadEmail}&gt;</span>
      </label>
      <textarea
        id={fieldId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={MAX_LENGTH}
        autoFocus
        disabled={!inbox || sending}
        placeholder={`Hi ${leadName.split(/\s+/)[0] || leadName},`}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange disabled:opacity-60"
      />
      {inbox ? (
        <p className="text-xs text-caption">
          Signed with your name and sent with their message quoted below it. Their answer goes to <strong>{inbox}</strong>.
        </p>
      ) : (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Set a contact email in <Link href="/admin/settings" className="underline">Site Settings</Link> before replying. Replies use it as
          Reply-To, so the lead&apos;s answer reaches your inbox.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-caption tabular-nums mr-auto">
          {body.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={sending}
          className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
        >
          <X size={14} /> Cancel
        </button>
        <button
          type="submit"
          disabled={!inbox || sending || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-orange-deep text-white text-sm font-medium hover:bg-brand-orange disabled:opacity-50"
        >
          <Send size={14} />
          {sending ? "Sending..." : "Send reply"}
        </button>
      </div>
    </form>
  );
}
