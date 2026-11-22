"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { createApprovalRequest } from "@/app/(admin)/actions/client-projects";
import { withToast } from "@/lib/admin/toast";

const input = "w-full min-h-11 px-4 py-2 border border-border rounded-lg bg-background text-foreground text-base";

/** Ask the client to approve something. Sets the project to "Waiting on client" and notifies them. */
export default function ApprovalRequestForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await withToast(createApprovalRequest(projectId, { title, description }), { success: "Approval requested", error: "Couldn't request approval" });
          if (r.success) {
            setTitle("");
            setDescription("");
            router.refresh();
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <input aria-label="What should the client approve?" required maxLength={200} placeholder="What should the client approve?" value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
      <textarea aria-label="Details (optional)" rows={2} maxLength={5000} placeholder="Details or a link (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} py-2`} />
      <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-background disabled:opacity-50">
        <CheckSquare size={16} /> Request approval
      </button>
    </form>
  );
}
