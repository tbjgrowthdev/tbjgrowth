import { CheckCircle2, Circle } from "lucide-react";
import { fill, formatDate, type PortalLanguage, type PortalStrings } from "@/lib/portal/strings";

type Milestone = { id: string; title: string; dueDate: Date | string | null; doneAt: Date | string | null };

/** Vertical milestone list: done ones ticked, the rest with their due date. */
export default function MilestoneTimeline({ milestones, t, language }: { milestones: Milestone[]; t: PortalStrings["projects"]; language: PortalLanguage }) {
  if (milestones.length === 0) return <p className="text-sm text-muted">{t.noMilestones}</p>;
  return (
    <ol className="relative space-y-3 border-s-2 border-[var(--border-c)] ps-5">
      {milestones.map((m) => (
        <li key={m.id} className="relative">
          <span className="absolute -start-[1.95rem] top-0.5 bg-[var(--card-bg)]">
            {m.doneAt ? <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Circle size={20} className="text-muted" aria-hidden="true" />}
          </span>
          <p className={`font-medium break-words ${m.doneAt ? "text-muted" : ""}`}>{m.title}</p>
          {(m.doneAt || m.dueDate) && (
            <p className="text-sm text-muted">
              {m.doneAt ? fill(t.milestoneDone, { date: formatDate(m.doneAt, language) }) : fill(t.milestoneDue, { date: formatDate(m.dueDate!, language) })}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
