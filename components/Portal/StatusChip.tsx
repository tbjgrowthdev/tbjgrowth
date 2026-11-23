import type { PortalStrings } from "@/lib/portal/strings";

type Status = keyof PortalStrings["status"];

const STYLE: Record<Status, string> = {
  NOT_STARTED: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-200",
  IN_PROGRESS: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  WAITING_ON_CLIENT: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
};

/** Large, readable project status chip. */
export default function StatusChip({ status, labels }: { status: string; labels: PortalStrings["status"] }) {
  const s = (status in STYLE ? status : "IN_PROGRESS") as Status;
  return <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-sm font-semibold ${STYLE[s]}`}>{labels[s]}</span>;
}

/** Progress bar with its percentage as text (screen readers get the number). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--tint-bg)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-[var(--admin-orange-text)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
