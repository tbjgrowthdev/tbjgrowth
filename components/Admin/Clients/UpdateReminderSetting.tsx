"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUpdateReminderDays } from "@/app/(admin)/actions/client-projects";
import { withToast } from "@/lib/admin/toast";

/** Global default for "projects needing an update" (0–60 days, 0 = off). Projects can override it. */
export default function UpdateReminderSetting({ days }: { days: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(days));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await withToast(setUpdateReminderDays(Number(value)), { success: "Reminder setting saved", error: "Couldn't save the setting" });
          if (!r.success) setError(r.error);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="reminder-days" className="block text-sm font-medium text-muted mb-1">Remind after (days without an update)</label>
        <input id="reminder-days" type="number" inputMode="numeric" min={0} max={60} required value={value} onChange={(e) => setValue(e.target.value)} className="w-28 min-h-11 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-base" />
      </div>
      <button type="submit" disabled={busy} className="min-h-11 px-4 py-2 rounded-lg border border-border hover:bg-background disabled:opacity-50">Save</button>
      <p className="w-full text-xs text-caption">0 turns reminders off. Each project can set its own number.</p>
      {error && <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">{error}</p>}
    </form>
  );
}
