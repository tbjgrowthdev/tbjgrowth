"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Send, LogOut, Trash2 } from "lucide-react";
import { bookCall } from "@/app/(portal)/actions/booking";
import { sendRequest } from "@/app/(portal)/actions/requests";
import { setLanguage, requestAccountDeletion } from "@/app/(portal)/actions/profile";
import { signOutClient } from "@/app/(portal)/actions/auth";
import { setClientPushPreference } from "@/app/(portal)/actions/push";
import type { ClientPushEventName } from "@/lib/portal/push-devices";
import type { PortalStrings } from "@/lib/portal/strings";

type T = PortalStrings["more"];
const field = "w-full rounded-xl border border-border bg-[var(--card-bg)] px-4 py-3 text-base";

function Note({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
      {msg.text}
    </p>
  );
}

/** Pick a free slot (labels formatted on the server) and book it. */
export function BookCallForm({ slots, t }: { slots: Array<{ id: string; label: string }>; t: T }) {
  const router = useRouter();
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (slots.length === 0) return <p className="text-sm text-muted">{t.noSlots}</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const r = await bookCall({ slotId, message });
          if (r.success) {
            setMsg({ ok: true, text: t.booked });
            setMessage("");
          } else {
            setMsg({ ok: false, text: r.error === "taken" ? t.taken : t.error });
            if (r.error === "signed_out") router.push("/portal/signout");
          }
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="slot" className="block text-sm font-semibold">{t.pickTime}</label>
      <select id="slot" value={slotId} onChange={(e) => setSlotId(e.target.value)} className={field}>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <label htmlFor="book-msg" className="block text-sm font-semibold">{t.bookMessage}</label>
      <textarea id="book-msg" rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={field} />
      <button type="submit" disabled={busy || !slotId} className="btn-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-60">
        <CalendarPlus size={18} aria-hidden="true" /> {t.book}
      </button>
      <Note msg={msg} />
    </form>
  );
}

export function RequestForm({ t }: { t: T }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const r = await sendRequest({ message });
          if (r.success) {
            setMsg({ ok: true, text: t.requestSent });
            setMessage("");
            router.refresh();
          } else {
            setMsg({ ok: false, text: r.error === "empty" ? t.requestEmpty : r.error === "too_long" ? t.requestTooLong : t.error });
            if (r.error === "signed_out") router.push("/portal/signout");
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="req" className="block text-sm font-semibold">{t.requestLabel}</label>
      <textarea id="req" required rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.requestPlaceholder} className={field} />
      <button type="submit" disabled={busy} className="btn-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-60">
        <Send size={18} aria-hidden="true" /> {t.requestSend}
      </button>
      <Note msg={msg} />
    </form>
  );
}

export function LanguageSwitch({ current }: { current: "en" | "bn" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const choose = async (language: "en" | "bn") => {
    if (language === current) return;
    setBusy(true);
    try {
      await setLanguage({ language });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2" role="group">
      {(["en", "bn"] as const).map((l) => (
        <button key={l} type="button" disabled={busy} aria-pressed={current === l} onClick={() => choose(l)} className={`min-h-12 rounded-2xl border px-4 font-semibold ${current === l ? "border-[var(--admin-orange-text)] text-[var(--admin-orange-text)]" : "border-border"}`}>
          {l === "en" ? "English" : "বাংলা"}
        </button>
      ))}
    </div>
  );
}

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOutClient();
        router.replace("/portal/login");
      }}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 font-semibold"
    >
      <LogOut size={18} aria-hidden="true" /> {label}
    </button>
  );
}

/** Two-step (button, then confirm) so it isn't sent by accident. No browser dialog. */
export function DeletionRequest({ t, requestedLabel }: { t: T; requestedLabel: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (requestedLabel) return <p className="text-sm font-semibold">{requestedLabel}</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t.deleteBody}</p>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t.deleteConfirm}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await requestAccountDeletion();
                setBusy(false);
                if (r.success) router.refresh();
                else setFailed(true);
              }}
              className="min-h-12 rounded-2xl bg-red-700 px-4 font-semibold text-white disabled:opacity-60"
            >
              {t.deleteButton}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-2xl border border-border px-4 font-semibold">✕</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-red-300 px-4 font-semibold text-red-700 dark:border-red-900 dark:text-red-300">
          <Trash2 size={18} aria-hidden="true" /> {t.deleteButton}
        </button>
      )}
      {failed && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t.error}</p>}
    </div>
  );
}

/** One switch per push event; saves on change. */
export function NotificationSettings({ preferences, labels }: { preferences: Array<{ event: ClientPushEventName; enabled: boolean }>; labels: T["notify"] }) {
  const [state, setState] = useState(preferences);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-[var(--border-c)]">
      {state.map((p) => (
        <li key={p.event}>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="font-semibold">{labels[p.event]}</span>
            <input
              type="checkbox"
              role="switch"
              className="h-6 w-6"
              checked={p.enabled}
              disabled={busy === p.event}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setBusy(p.event);
                setState((s) => s.map((x) => (x.event === p.event ? { ...x, enabled } : x)));
                const r = await setClientPushPreference(p.event, enabled);
                if (!r.success) setState((s) => s.map((x) => (x.event === p.event ? { ...x, enabled: !enabled } : x)));
                setBusy(null);
              }}
            />
          </label>
        </li>
      ))}
    </ul>
  );
}
