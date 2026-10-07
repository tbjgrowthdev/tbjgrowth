"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import AuditLogDeleteButton from "./AuditLogDeleteButton";

type LogEntry = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  action: string;
  category: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  before: string | null;
  after: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date | string;
};

const CATEGORIES = ["Content", "SEO", "Settings", "Users", "Roles", "Publishing", "Approval", "Media", "Redirects", "Integrations"];

function formatJson(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AuditLogTable({ logs, canDelete }: { logs: LogEntry[]; canDelete: boolean }) {
  const [category, setCategory] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => (category ? logs.filter((l) => l.category === category) : logs),
    [logs, category]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">Category:</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg bg-background text-foreground text-sm"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-sm text-caption">{filtered.length} entries</span>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-background border-b border-border">
                <th className="px-4 py-3 font-semibold text-foreground"></th>
                <th className="px-4 py-3 font-semibold text-foreground">User</th>
                <th className="px-4 py-3 font-semibold text-foreground">Action</th>
                <th className="px-4 py-3 font-semibold text-foreground">Category</th>
                <th className="px-4 py-3 font-semibold text-foreground">Entity</th>
                <th className="px-4 py-3 font-semibold text-foreground">IP</th>
                <th className="px-4 py-3 font-semibold text-foreground">Time</th>
                {canDelete && <th className="px-4 py-3 font-semibold text-foreground text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => {
                const isOpen = expanded === log.id;
                const before = formatJson(log.before);
                const after = formatJson(log.after);
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-background cursor-pointer" onClick={() => setExpanded(isOpen ? null : log.id)}>
                      <td className="px-4 py-3 text-caption">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground font-medium">{log.userName || log.userEmail || "Unknown"}</div>
                        <div className="text-caption text-xs">{log.userRole || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{log.action}</td>
                      <td className="px-4 py-3 text-caption">{log.category}</td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{log.entityType}</div>
                        {log.entityLabel && <div className="text-caption text-xs truncate max-w-[200px]">{log.entityLabel}</div>}
                      </td>
                      <td className="px-4 py-3 text-caption text-xs">{log.ipAddress || "—"}</td>
                      <td className="px-4 py-3 text-caption text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      {canDelete && (
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <AuditLogDeleteButton id={log.id} />
                        </td>
                      )}
                    </tr>
                    {isOpen && (
                      <tr className="bg-background">
                        <td colSpan={canDelete ? 8 : 7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <div className="font-medium text-muted mb-1">Before</div>
                              <pre className="bg-card border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                {before || "—"}
                              </pre>
                            </div>
                            <div>
                              <div className="font-medium text-muted mb-1">After</div>
                              <pre className="bg-card border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                                {after || "—"}
                              </pre>
                            </div>
                          </div>
                          {log.userAgent && (
                            <p className="text-caption text-xs mt-2 truncate">Device: {log.userAgent}</p>
                          )}
                          {log.entityId && (
                            <p className="text-caption text-xs mt-1">Entity ID: {log.entityId}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="px-6 py-8 text-center text-caption">
                    No audit log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
