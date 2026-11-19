"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { setPushPreference } from "@/app/(admin)/actions/push";
import { withToast } from "@/lib/admin/toast";

type Preference = { event: "NEW_LEAD" | "NEW_BOOKING" | "CONTENT_AWAITING_APPROVAL"; enabled: boolean };

const LABELS: Record<Preference["event"], { title: string; hint: string }> = {
  NEW_LEAD: { title: "New leads", hint: "Someone sends the contact form." },
  NEW_BOOKING: { title: "New bookings", hint: "Someone books a call." },
  CONTENT_AWAITING_APPROVAL: { title: "Content awaiting approval", hint: "A post is submitted for review." },
};

// Profile → Notifications. Only lists the events this user's role can get
// (lib/push/recipients.ts). Notifications arrive on the TBJ Admin Android app.
export default function NotificationSettings({ initialPreferences }: { initialPreferences: Preference[] }) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (event: Preference["event"], enabled: boolean) => {
    setBusy(event);
    try {
      const result = await withToast(setPushPreference(event, enabled), {
        success: enabled ? "Notifications on" : "Notifications off",
        error: "Couldn't save notification setting",
      });
      if (result.success) setPrefs((p) => p.map((x) => (x.event === event ? { ...x, enabled } : x)));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-card p-4 sm:p-6 rounded-xl shadow-sm border border-border space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-caption" />
        <h2 className="text-xl font-bold text-foreground">Notifications</h2>
      </div>
      <p className="text-sm text-caption">
        Push notifications arrive on your phone through the TBJ Admin app.{" "}
        <Link href="/admin/app" className="text-brand-orange-deep underline underline-offset-2">Get the Admin app</Link>.
        They never show client details on the lock screen.
      </p>
      {prefs.length === 0 ? (
        <p className="text-sm text-caption">Your role has no notifications to choose from.</p>
      ) : (
        <ul className="divide-y divide-border">
          {prefs.map((p) => (
            <li key={p.event} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{LABELS[p.event].title}</p>
                <p className="text-sm text-caption">{LABELS[p.event].hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={p.enabled}
                aria-label={LABELS[p.event].title}
                disabled={busy === p.event}
                onClick={() => toggle(p.event, !p.enabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${p.enabled ? "bg-brand-orange-deep" : "bg-border"}`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${p.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
