"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { setClientRequestStatus } from "@/app/(admin)/actions/client-requests";
import { withToast } from "@/lib/admin/toast";

export default function RequestStatusButton({ id, status }: { id: string; status: "OPEN" | "DONE" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "OPEN" ? "DONE" : "OPEN";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await withToast(setClientRequestStatus(id, next), { success: next === "DONE" ? "Marked done" : "Reopened", error: "Couldn't change the request" });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-background disabled:opacity-50"
    >
      {next === "DONE" ? <Check size={16} /> : <RotateCcw size={16} />} {next === "DONE" ? "Mark done" : "Reopen"}
    </button>
  );
}
