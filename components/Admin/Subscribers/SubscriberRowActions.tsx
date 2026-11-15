"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, UserMinus } from "lucide-react";
import { deleteSubscriber, setSubscriberStatus } from "@/app/(admin)/actions/newsletter";
import { confirmDialog } from "@/lib/admin/dialog";
import { withToast } from "@/lib/admin/toast";

export default function SubscriberRowActions({
  id,
  email,
  status,
}: {
  id: string;
  email: string;
  status: "ACTIVE" | "UNSUBSCRIBED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (action: Promise<unknown>, success: string, error: string) => {
    setBusy(true);
    try {
      await withToast(action, { success, error });
      router.refresh();
    } catch {
      // withToast already showed the error.
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    status === "ACTIVE"
      ? run(setSubscriberStatus(id, "UNSUBSCRIBED"), "Subscriber unsubscribed", "Couldn't unsubscribe")
      : run(setSubscriberStatus(id, "ACTIVE"), "Subscriber reactivated", "Couldn't reactivate");

  const remove = async () => {
    const ok = await confirmDialog({
      title: "Delete this subscriber?",
      text: `${email} will be removed permanently. To keep a record that they opted out, unsubscribe them instead.`,
      confirmText: "Delete",
      danger: true,
    });
    if (ok) await run(deleteSubscriber(id), "Subscriber deleted", "Couldn't delete subscriber");
  };

  const btn = "inline-flex items-center gap-1 text-xs font-medium disabled:opacity-50";

  return (
    <div className="flex items-center justify-end gap-4">
      <button type="button" onClick={toggle} disabled={busy} className={`${btn} text-muted hover:text-foreground`}>
        {status === "ACTIVE" ? <UserMinus size={14} /> : <RotateCcw size={14} />}
        {status === "ACTIVE" ? "Unsubscribe" : "Reactivate"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className={`${btn} text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}
      >
        <Trash2 size={14} />
        Delete
      </button>
    </div>
  );
}
