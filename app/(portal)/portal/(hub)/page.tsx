import Link from "next/link";
import { FolderKanban, CalendarClock, ChevronRight } from "lucide-react";
import { requireClientPage } from "@/lib/portal/page-guard";
import { fill, formatDate, formatTime, portalStrings } from "@/lib/portal/strings";
import { listApprovals, listMeetings, listProjects, listRecentUpdates } from "@/lib/portal/data";
import StatusChip, { ProgressBar } from "@/components/Portal/StatusChip";
import ApprovalCard from "@/components/Portal/ApprovalCard";
import UpdateFeed from "@/components/Portal/UpdateFeed";

// Home: what needs the client's attention first ("Waiting on you"), then
// their active projects, the next meeting and the latest update. All data
// comes through lib/portal/data.ts, scoped to the session's client.
export default async function PortalHomePage() {
  const ctx = await requireClientPage();
  const lang = ctx.language;
  const t = portalStrings(lang);
  const [projects, pending, meetings, latest] = await Promise.all([listProjects(ctx), listApprovals(ctx, { status: "PENDING" }), listMeetings(ctx), listRecentUpdates(ctx, 1)]);
  const active = projects.filter((p) => p.status !== "COMPLETED");
  const next = meetings[0];

  if (projects.length === 0 && pending.length === 0 && !next) {
    return (
      <div className="space-y-4">
        <h1 className="admin-title text-2xl">{t.home.welcome}</h1>
        <section className="admin-card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--tint-bg)] text-[var(--admin-orange-text)]">
            <FolderKanban size={24} aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold">{t.home.emptyTitle}</h2>
          <p className="max-w-sm text-sm text-muted">{t.home.emptyBody}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="admin-title text-2xl">{t.home.welcome}</h1>

      {pending.length > 0 && (
        <section className="space-y-3" aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-bold">{t.home.waitingOnYou}</h2>
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} t={t.approvals} />
          ))}
        </section>
      )}

      {active.length > 0 && (
        <section className="space-y-3" aria-labelledby="active">
          <div className="flex items-center justify-between gap-2">
            <h2 id="active" className="text-lg font-bold">{t.home.activeProjects}</h2>
            <Link href="/portal/projects" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--admin-orange-text)]">{t.home.seeAllProjects}</Link>
          </div>
          {active.map((p) => (
            <Link key={p.id} href={`/portal/projects/${p.id}`} className="admin-card block space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold break-words">{p.title}</h3>
                <ChevronRight size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              </div>
              <StatusChip status={p.status} labels={t.status} />
              <ProgressBar value={p.progress} label={fill(t.projects.progress, { n: String(p.progress) })} />
            </Link>
          ))}
        </section>
      )}

      {next && (
        <section className="admin-card flex items-center gap-3 p-4" aria-labelledby="meeting">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tint-bg)] text-[var(--admin-orange-text)]">
            <CalendarClock size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 id="meeting" className="text-sm font-semibold text-muted">{t.home.nextMeeting}</h2>
            <p className="font-bold">{fill(t.meetingAt, { date: formatDate(next.startsAt, lang), time: formatTime(next.startsAt, lang) })}</p>
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <section className="space-y-3" aria-labelledby="latest">
          <h2 id="latest" className="text-lg font-bold">{t.home.latestUpdate}</h2>
          <UpdateFeed updates={latest} t={t.projects} language={lang} showProject />
        </section>
      )}
    </div>
  );
}
