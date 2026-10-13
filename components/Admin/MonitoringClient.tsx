"use client";

import { useState } from "react";
import { DatabaseBackup, Activity, Bug, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type BackupRun = {
  id: string;
  startedAt: string | Date;
  completedAt: string | Date;
  success: boolean;
  sizeBytes: number | null;
  objectKey: string | null;
  verified: boolean;
  error: string | null;
};

type UptimeCheck = {
  id: string;
  checkedAt: string | Date;
  up: boolean;
  statusCode: number | null;
  contentOk: boolean;
  latencyMs: number | null;
  error: string | null;
};

type ErrorLog = {
  id: string;
  message: string;
  path: string | null;
  source: string;
  createdAt: string | Date;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export default function MonitoringClient({
  backups,
  uptime,
  errors,
}: {
  backups: BackupRun[];
  uptime: UptimeCheck[];
  errors: ErrorLog[];
}) {
  const [tab, setTab] = useState<"backups" | "uptime" | "errors">("backups");

  const latestBackup = backups[0];
  const latestUptime = uptime[0];
  const currentlyUp = latestUptime ? latestUptime.up && latestUptime.contentOk : true;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={DatabaseBackup}
          label="Last backup"
          value={latestBackup ? new Date(latestBackup.startedAt).toLocaleString() : "No runs yet"}
          status={!latestBackup ? "unknown" : latestBackup.success && latestBackup.verified ? "ok" : "bad"}
          detail={latestBackup ? (latestBackup.success ? (latestBackup.verified ? "Verified" : "Not verified") : "Failed") : undefined}
        />
        <SummaryCard
          icon={Activity}
          label="Uptime"
          value={currentlyUp ? "Up" : "Down / degraded"}
          status={!latestUptime ? "unknown" : currentlyUp ? "ok" : "bad"}
          detail={latestUptime ? `Last checked ${new Date(latestUptime.checkedAt).toLocaleString()}` : undefined}
        />
        <SummaryCard
          icon={Bug}
          label="Errors (recent)"
          value={String(errors.length)}
          status={errors.length === 0 ? "ok" : "warn"}
          detail={errors[0] ? new Date(errors[0].createdAt).toLocaleString() : undefined}
        />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["backups", "uptime", "errors"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === id ? "border-brand-orange-deep text-brand-orange-deep" : "border-transparent text-caption hover:text-foreground"
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {tab === "backups" && (
        <Table
          emptyLabel="No backup runs recorded yet."
          rows={backups}
          columns={[
            { header: "Started", render: (r: BackupRun) => new Date(r.startedAt).toLocaleString() },
            { header: "Status", render: (r: BackupRun) => <StatusBadge ok={r.success} label={r.success ? "Success" : "Failed"} /> },
            { header: "Verified", render: (r: BackupRun) => <StatusBadge ok={r.verified} label={r.verified ? "Verified" : "Unverified"} /> },
            { header: "Size", render: (r: BackupRun) => formatBytes(r.sizeBytes) },
            { header: "Object", render: (r: BackupRun) => <span className="font-mono text-xs">{r.objectKey ?? "—"}</span> },
            { header: "Error", render: (r: BackupRun) => <span className="text-xs text-red-600 dark:text-red-400">{r.error ?? ""}</span> },
          ]}
        />
      )}

      {tab === "uptime" && (
        <Table
          emptyLabel="No uptime checks recorded yet."
          rows={uptime}
          columns={[
            { header: "Checked", render: (r: UptimeCheck) => new Date(r.checkedAt).toLocaleString() },
            { header: "Status", render: (r: UptimeCheck) => <StatusBadge ok={r.up && r.contentOk} label={r.up && r.contentOk ? "Up" : "Down"} /> },
            { header: "HTTP", render: (r: UptimeCheck) => r.statusCode ?? "—" },
            { header: "Content OK", render: (r: UptimeCheck) => (r.contentOk ? "Yes" : "No — degraded") },
            { header: "Latency", render: (r: UptimeCheck) => (r.latencyMs ? `${r.latencyMs}ms` : "—") },
          ]}
        />
      )}

      {tab === "errors" && (
        <Table
          emptyLabel="No errors captured yet."
          rows={errors}
          columns={[
            { header: "When", render: (r: ErrorLog) => new Date(r.createdAt).toLocaleString() },
            { header: "Source", render: (r: ErrorLog) => r.source },
            { header: "Path", render: (r: ErrorLog) => <span className="font-mono text-xs">{r.path ?? "—"}</span> },
            { header: "Message", render: (r: ErrorLog) => <span className="text-xs">{r.message}</span> },
          ]}
        />
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  status,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  status: "ok" | "warn" | "bad" | "unknown";
  detail?: string;
}) {
  const color = status === "ok" ? "text-green-500" : status === "warn" ? "text-amber-500" : status === "bad" ? "text-red-500" : "text-caption";
  return (
    <div className="bg-card p-4 rounded-lg border border-border">
      <div className="flex items-center gap-2 text-xs text-caption mb-1">
        <Icon size={14} />
        {label}
      </div>
      <p className="text-lg font-semibold text-foreground flex items-center gap-2">
        {status === "ok" ? <CheckCircle2 size={16} className={color} /> : status === "unknown" ? null : <AlertTriangle size={16} className={color} />}
        {value}
      </p>
      {detail && <p className="text-xs text-caption mt-1">{detail}</p>}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      {ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {label}
    </span>
  );
}

function Table<T extends { id: string }>({
  rows,
  columns,
  emptyLabel,
}: {
  rows: T[];
  columns: { header: string; render: (row: T) => React.ReactNode }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <div className="bg-card p-6 rounded-lg border border-border text-center text-caption">{emptyLabel}</div>;
  }
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-background">
            {columns.map((c) => (
              <th key={c.header} className="px-6 py-3 font-medium text-caption whitespace-nowrap">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.header} className="px-6 py-3 text-foreground whitespace-nowrap">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
