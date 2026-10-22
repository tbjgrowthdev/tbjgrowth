"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Server, Mail, Webhook, Plug, Bot, Send } from "lucide-react";
import { getObservabilityDataAction } from "@/app/(admin)/actions/observability";
import type { ObservabilityData } from "@/lib/observability/types";

const WINDOW_LABEL: Record<number, string> = { 24: "Last 24h", 168: "Last 7d", 720: "Last 30d" };

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default function ObservabilityClient({ initialData, initialHours }: { initialData: ObservabilityData | null; initialHours: number }) {
  const [data, setData] = useState(initialData);
  const [hours, setHours] = useState(initialHours);
  const [loading, setLoading] = useState(false);

  async function changeWindow(next: number) {
    setHours(next);
    setLoading(true);
    const result = await getObservabilityDataAction(next);
    setData(result);
    setLoading(false);
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Observability</h1>
        <p className="text-caption">You don&apos;t have permission to view this.</p>
      </div>
    );
  }

  const { application, infrastructure, business } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observability</h1>
          <p className="text-caption">
            Application errors, request/query performance, and business-critical failures — rolled up from the signals this app already records
            (ErrorLog, UptimeCheck, AiJob, ScheduledJob, Integration Hub, EmailLog, SlowQueryLog). No external monitoring agent is involved.
          </p>
        </div>
        <div className="flex gap-1 bg-tint rounded-lg p-1 shrink-0">
          {[24, 168, 720].map((h) => (
            <button
              key={h}
              onClick={() => changeWindow(h)}
              disabled={loading}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                hours === h ? "bg-card text-foreground shadow-sm font-medium" : "text-caption hover:text-foreground"
              }`}
            >
              {WINDOW_LABEL[h]}
            </button>
          ))}
        </div>
      </div>

      {/* Application */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Application</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Errors & exceptions" value={application.errorCount} warnAbove={0} />
          <StatCard icon={Server} label="API failures" value={application.apiFailureCount} warnAbove={0} detail="Server errors under /api/*" />
          <StatCard icon={AlertTriangle} label="Slow requests" value={application.slowRequestCount} warnAbove={0} detail="Poor-rated TTFB samples" />
          <StatCard icon={Database} label="Slow queries" value={application.slowQueryCount} warnAbove={0} detail="Over the 1000ms threshold" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-caption">
          <p>
            Server-side: {application.serverErrorCount} · Client-side: {application.clientErrorCount}
          </p>
        </div>

        <RecentTable
          title="Recent errors"
          emptyLabel="No errors captured in this window."
          rows={application.recentErrors}
          columns={[
            { header: "When", render: (r) => fmt(r.createdAt) },
            { header: "Source", render: (r) => r.source },
            { header: "Path", render: (r) => <span className="font-mono text-xs">{r.path ?? "—"}</span> },
            { header: "Message", render: (r) => <span className="text-xs">{r.message}</span> },
          ]}
        />

        <RecentTable
          title="Recent slow queries"
          emptyLabel="No slow queries in this window."
          rows={application.recentSlowQueries}
          columns={[
            { header: "When", render: (r) => fmt(r.createdAt) },
            { header: "Model", render: (r) => r.model ?? "—" },
            { header: "Action", render: (r) => r.action },
            { header: "Duration", render: (r) => `${r.durationMs}ms` },
          ]}
        />
      </section>

      {/* Infrastructure */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Infrastructure</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Database}
            label="Database"
            value={infrastructure.databaseReachable ? "Reachable" : "Unreachable"}
            bad={!infrastructure.databaseReachable}
            detail={infrastructure.databaseLatencyMs != null ? `Pinged in ${infrastructure.databaseLatencyMs}ms` : undefined}
          />
          <StatCard
            icon={Server}
            label="API latency (avg)"
            value={infrastructure.avgApiLatencyMs != null ? `${infrastructure.avgApiLatencyMs}ms` : "No data"}
            detail="External uptime probe, GitHub Actions"
          />
        </div>
        {infrastructure.apiLatencyTrend.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Uptime probe latency trend</h3>
            <MiniBarChart points={infrastructure.apiLatencyTrend.map((p) => ({ label: fmt(p.checkedAt), value: p.latencyMs ?? 0, bad: !p.up }))} />
          </div>
        )}
        <p className="text-xs text-caption bg-tint rounded-lg px-4 py-3">
          CPU, RAM, disk, and object storage (R2/Cloudinary) aren&apos;t tracked here — this app runs on Cloudflare Workers, which doesn&apos;t expose
          those metrics to application code. See the Cloudflare dashboard (Workers &amp; Pages → Metrics) and the Cloudinary dashboard for those.
        </p>
      </section>

      {/* Business */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Business</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Send} label="Failed publishing" value={business.failedPublishingCount} warnAbove={0} />
          <StatCard icon={Bot} label="Failed AI jobs" value={business.failedAiJobCount} warnAbove={0} />
          <StatCard icon={Plug} label="Failed integrations" value={business.failedIntegrations.length} warnAbove={0} />
          <StatCard icon={Webhook} label="Failed webhooks" value={business.failedWebhookCount} warnAbove={0} />
          <StatCard icon={Mail} label="Failed emails" value={business.failedEmailCount} warnAbove={0} />
        </div>

        <RecentTable
          title="Failed publishing (scheduled jobs)"
          emptyLabel="No failed scheduled jobs in this window."
          rows={business.failedPublishing}
          columns={[
            { header: "When", render: (r) => fmt(r.lastAttemptAt) },
            { header: "Job", render: (r) => r.jobType },
            { header: "Content", render: (r) => <span className="font-mono text-xs">{r.contentType} · {r.contentId}</span> },
            { header: "Attempts", render: (r) => r.attempts },
            { header: "Error", render: (r) => <span className="text-xs text-red-600 dark:text-red-400">{r.lastError ?? "—"}</span> },
          ]}
        />

        <RecentTable
          title="Failed AI jobs"
          emptyLabel="No failed AI jobs in this window."
          rows={business.failedAiJobs}
          columns={[
            { header: "When", render: (r) => fmt(r.completedAt) },
            { header: "Stage", render: (r) => r.stage },
            { header: "Model", render: (r) => <span className="font-mono text-xs">{r.provider}/{r.model}</span> },
            { header: "Error", render: (r) => <span className="text-xs text-red-600 dark:text-red-400">{r.error ?? "—"}</span> },
          ]}
        />

        {business.failedIntegrations.length > 0 && (
          <RecentTable
            title="Failed integrations"
            emptyLabel=""
            rows={business.failedIntegrations.map((i, idx) => ({ ...i, id: String(idx) }))}
            columns={[
              { header: "Integration", render: (r) => r.label },
              { header: "Category", render: (r) => r.category },
              { header: "Checked", render: (r) => fmt(r.lastCheckedAt) },
              { header: "Error", render: (r) => <span className="text-xs text-red-600 dark:text-red-400">{r.lastError ?? "—"}</span> },
            ]}
          />
        )}

        <RecentTable
          title="Failed webhooks"
          emptyLabel="No failed webhook deliveries in this window."
          rows={business.failedWebhooks}
          columns={[
            { header: "When", render: (r) => fmt(r.createdAt) },
            { header: "Rule", render: (r) => <span className="font-mono text-xs">{r.ruleId}</span> },
            { header: "Error", render: (r) => <span className="text-xs text-red-600 dark:text-red-400">{r.error ?? "—"}</span> },
          ]}
        />

        <RecentTable
          title="Failed emails"
          emptyLabel="No failed email sends in this window."
          rows={business.failedEmails}
          columns={[
            { header: "When", render: (r) => fmt(r.createdAt) },
            { header: "Type", render: (r) => r.type },
            { header: "To", render: (r) => r.to },
            { header: "Error", render: (r) => <span className="text-xs text-red-600 dark:text-red-400">{r.error ?? "—"}</span> },
          ]}
        />
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  warnAbove,
  bad,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  detail?: string;
  warnAbove?: number;
  bad?: boolean;
}) {
  const numeric = typeof value === "number" ? value : null;
  const isWarn = bad || (warnAbove != null && numeric != null && numeric > warnAbove);
  const color = isWarn ? "text-amber-500" : "text-green-500";
  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <div className="flex items-center gap-2 text-xs text-caption mb-1">
        <Icon size={14} />
        {label}
      </div>
      <p className="text-lg font-semibold text-foreground flex items-center gap-2">
        {isWarn ? <AlertTriangle size={16} className={color} /> : <CheckCircle2 size={16} className={color} />}
        {value}
      </p>
      {detail && <p className="text-xs text-caption mt-1">{detail}</p>}
    </div>
  );
}

function RecentTable<T extends { id: string }>({
  title,
  rows,
  columns,
  emptyLabel,
}: {
  title: string;
  rows: T[];
  columns: { header: string; render: (row: T) => React.ReactNode }[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <div className="bg-card p-6 rounded-lg border border-border text-center text-caption text-sm">{emptyLabel}</div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background">
                {columns.map((c) => (
                  <th key={c.header} className="px-4 py-2 font-medium text-caption whitespace-nowrap">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.header} className="px-4 py-2 text-foreground whitespace-nowrap">
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ points }: { points: { label: string; value: number; bad: boolean }[] }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="flex items-end gap-0.5 h-24">
      {points.map((p, i) => (
        <div
          key={i}
          title={`${p.label}: ${p.value}ms${p.bad ? " (down)" : ""}`}
          className={`flex-1 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity ${
            p.bad ? "bg-red-500" : "bg-gradient-to-t from-brand-orange-deep to-brand-orange-light"
          }`}
          style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
