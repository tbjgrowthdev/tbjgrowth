import Link from "next/link";
import Image from "next/image";
import prisma from "@/lib/prisma";
import { getWebVitalsSummary, getRecentFailedLogins } from "@/app/(admin)/actions/technical";
import { getCurrentAdmin } from "@/app/(admin)/actions/profile";
import { hasPermission } from "@/lib/permissions";
import { isValidImageSrc } from "@/lib/utils";
import SslChecker from "@/components/Admin/SslChecker";
import PageTitle from "@/components/Admin/PageTitle";
import DashboardGreeting from "@/components/Admin/DashboardGreeting";
import { FileText, FileEdit, Users, ShieldAlert, Database, Activity, CheckCircle2, TriangleAlert, XCircle, ArrowRight, Plus, Images, Inbox, Gauge } from "lucide-react";

const METRIC_LABELS: Record<string, string> = {
  LCP: "Largest Contentful Paint",
  CLS: "Cumulative Layout Shift",
  INP: "Interaction to Next Paint",
  FCP: "First Contentful Paint",
  TTFB: "Time to First Byte",
};

// Status is carried by icon + label + a left accent, never by color alone.
const RATING: Record<string, { label: string; icon: typeof CheckCircle2; tone: string; bar: string }> = {
  good: {
    label: "Good",
    icon: CheckCircle2,
    tone: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    bar: "bg-green-700 dark:bg-green-400",
  },
  "needs-improvement": {
    label: "Needs improvement",
    icon: TriangleAlert,
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
    bar: "bg-amber-700 dark:bg-amber-400",
  },
  poor: {
    label: "Poor",
    icon: XCircle,
    tone: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    bar: "bg-red-700 dark:bg-red-400",
  },
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  EDITOR: "Editor",
  SEO_MANAGER: "SEO Manager",
  CONTRIBUTOR: "Contributor",
};

function formatMetricValue(metric: string, value: number) {
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value)}ms`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  hrefLabel,
  emptyNote,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  href?: string;
  hrefLabel: string;
  emptyNote: string;
}) {
  return (
    <div className="admin-card flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-stat text-brand-orange-deep dark:text-brand-orange-light">
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 font-heading text-4xl font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1.5 min-h-[1.125rem] text-[0.8125rem] leading-snug text-caption">{value === 0 ? emptyNote : " "}</p>
      {href && (
        <Link href={href} className="mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-brand-orange-deep hover:underline dark:text-brand-orange-light">
          {hrefLabel}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [pageCount, publishedPostCount, newLeadsCount, vitals, failedLogins, admin] = await Promise.all([
    prisma.page.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.formSubmission.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    getWebVitalsSummary(),
    getRecentFailedLogins(24),
    getCurrentAdmin(),
  ]);

  const name = admin?.name || "Admin";
  const firstName = name.split(/\s+/)[0] || name;
  const role = admin?.role;
  const canSeeLeads = hasPermission(role, "USER_MANAGEMENT");
  const canSeeMedia = hasPermission(role, "MEDIA_MANAGEMENT");
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4">
      <PageTitle>Dashboard Overview</PageTitle>

      {/* Hero / greeting */}
      <section className="admin-card relative overflow-hidden p-4 sm:p-5" aria-label="Welcome">
        {/* Orbit rings: brand motif, one corner only */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 sm:-right-12">
          <span className="orbit inset-0" />
          <span className="orbit inset-8 opacity-70" />
          <span className="orbit inset-16 opacity-50" />
        </div>

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="avatar-ring !h-12 !w-12 !text-lg">
            {isValidImageSrc(admin?.image) ? <Image src={admin!.image!} alt="" fill className="object-cover" /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
          </span>
          <div className="min-w-0">
            <DashboardGreeting name={firstName} />
            <p className="mt-0.5 text-sm text-muted">Here&rsquo;s your site overview for today &mdash; {today}</p>
          </div>
          {role && (
            <div className="sm:ml-auto sm:pr-28">
              <span className="chip chip-ink">{ROLE_LABEL[role] ?? role}</span>
            </div>
          )}
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Link href="/admin/posts/new" className="btn-primary">
            <Plus size={16} aria-hidden="true" />
            New blog post
          </Link>
          <Link href="/admin/pages/new" className="btn-secondary">
            New page
          </Link>
          <Link href="/admin/cases/new" className="btn-secondary">
            New case study
          </Link>
          {canSeeMedia && (
            <Link href="/admin/media" className="btn-secondary">
              <Images size={15} aria-hidden="true" />
              Media library
            </Link>
          )}
          {canSeeLeads && (
            <Link href="/admin/leads" className="btn-secondary">
              <Inbox size={15} aria-hidden="true" />
              Leads
            </Link>
          )}
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Pages" value={pageCount} icon={FileText} href="/admin/pages" hrefLabel="Manage pages" emptyNote="No pages yet" />
        <StatCard label="Published Posts" value={publishedPostCount} icon={FileEdit} href="/admin/posts" hrefLabel="Manage posts" emptyNote="Nothing published yet" />
        <StatCard
          label="New Leads (30d)"
          value={newLeadsCount}
          icon={Users}
          href={canSeeLeads ? "/admin/leads" : undefined}
          hrefLabel="View leads"
          emptyNote="No new leads in the last 30 days"
        />
      </div>

      {/* Core Web Vitals */}
      <section className="admin-card p-4 sm:p-5" aria-labelledby="cwv-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-stat text-brand-orange-deep dark:text-brand-orange-light">
              <Activity size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Performance</p>
              <h2 id="cwv-title" className="font-heading text-base font-bold leading-tight tracking-tight text-foreground">
                Core Web Vitals (p75, last 7 days)
              </h2>
            </div>
          </div>
          <span className="chip chip-sand">{vitals.totalSamples} real visitor samples</span>
        </div>

        {vitals.metrics.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-[var(--admin-inset)] p-4">
            <Gauge size={20} className="flex-none text-caption" aria-hidden="true" />
            <p className="text-sm text-muted">No visitor data collected yet. Metrics populate automatically as people browse the live site.</p>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {vitals.metrics.map((m) => {
              const r = RATING[m.rating] ?? RATING.good;
              const StatusIcon = r.icon;
              return (
                <li key={m.metric} className="relative overflow-hidden rounded-2xl border border-border bg-[var(--admin-inset)] p-3 pl-4">
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${r.bar}`} />
                  <p className="eyebrow" title={METRIC_LABELS[m.metric]}>
                    {m.metric}
                  </p>
                  <p className="mt-0.5 font-heading text-xl font-bold tracking-tight text-foreground tabular-nums">{formatMetricValue(m.metric, m.p75)}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${r.tone}`}>
                    <StatusIcon size={13} aria-hidden="true" />
                    {r.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Technical Health */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SslChecker />

        <section className="admin-card p-4 sm:p-5" aria-labelledby="backup-title">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-stat text-brand-orange-deep dark:text-brand-orange-light">
              <Database size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Data</p>
              <h3 id="backup-title" className="font-heading text-base font-bold leading-tight tracking-tight text-foreground">
                Database Backups
              </h3>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Backups are managed by Neon (your Postgres host), which takes continuous point-in-time-recovery snapshots automatically. No action needed here — manage retention in your Neon project dashboard.
          </p>
        </section>

        <section className="admin-card p-4 sm:p-5" aria-labelledby="logins-title">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-stat text-brand-orange-deep dark:text-brand-orange-light">
                <ShieldAlert size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">Security</p>
                <h3 id="logins-title" className="font-heading text-base font-bold leading-tight tracking-tight text-foreground">
                  Failed Logins (24h)
                </h3>
              </div>
            </div>
            {failedLogins.length === 0 && <span className="chip chip-ink">All clear</span>}
          </div>
          {failedLogins.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-300">
              <CheckCircle2 size={16} aria-hidden="true" />
              No failed login attempts.
            </p>
          ) : (
            <ul className="mt-3 max-h-32 space-y-1.5 overflow-y-auto">
              {failedLogins.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-2 truncate rounded-xl bg-[var(--admin-inset)] px-3 py-1.5 text-xs text-muted">
                  <TriangleAlert size={13} className="flex-none text-amber-700 dark:text-amber-400" aria-hidden="true" />
                  <span className="truncate">
                    {a.email} — {new Date(a.createdAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
