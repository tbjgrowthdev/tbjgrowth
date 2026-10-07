"use client";

import { useState } from "react";
import { getContentApprovalHistory } from "@/app/(admin)/actions/workflow";
import type { WorkflowAction } from "@/lib/workflow";
import { History, Send, CheckCircle2, XCircle, MessageSquareWarning, CalendarClock, Rocket, Archive, RotateCcw, EyeOff } from "lucide-react";

type Status = "DRAFT" | "REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

const STATUS_LABEL: Record<Status, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300" },
  REVIEW: { label: "In Review", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
  CHANGES_REQUESTED: { label: "Changes Requested", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  APPROVED: { label: "Approved", className: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400" },
  SCHEDULED: { label: "Scheduled", className: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" },
  PUBLISHED: { label: "Published", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  ARCHIVED: { label: "Archived", className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
};

type ActionDef = { action: WorkflowAction; label: string; icon: typeof Send; needsComment?: boolean; danger?: boolean };

const ACTIONS_BY_STATUS: Record<Status, ActionDef[]> = {
  DRAFT: [
    { action: "submit", label: "Submit for Review", icon: Send },
    { action: "publish", label: "Publish Now", icon: Rocket },
    { action: "archive", label: "Archive", icon: Archive, danger: true },
  ],
  REVIEW: [
    { action: "approve", label: "Approve", icon: CheckCircle2 },
    { action: "requestChanges", label: "Request Changes", icon: MessageSquareWarning, needsComment: true },
    { action: "reject", label: "Reject", icon: XCircle, needsComment: true, danger: true },
  ],
  CHANGES_REQUESTED: [
    { action: "resubmit", label: "Re-submit for Review", icon: Send },
  ],
  APPROVED: [
    { action: "schedule", label: "Schedule", icon: CalendarClock },
    { action: "publish", label: "Publish Now", icon: Rocket },
    { action: "archive", label: "Archive", icon: Archive, danger: true },
  ],
  SCHEDULED: [
    { action: "publish", label: "Publish Now", icon: Rocket },
    { action: "unpublish", label: "Unpublish", icon: EyeOff },
    { action: "archive", label: "Archive", icon: Archive, danger: true },
  ],
  PUBLISHED: [
    { action: "unpublish", label: "Unpublish", icon: EyeOff },
    { action: "archive", label: "Archive", icon: Archive, danger: true },
  ],
  ARCHIVED: [
    { action: "restore", label: "Restore to Draft", icon: RotateCcw },
  ],
};

// Non-transition events (assignment changes, SEO sign-off) share the same
// ApprovalHistory table with fromStatus === toStatus — labeled by action
// instead of rendering a confusing "Draft → Draft".
const NON_TRANSITION_LABEL: Record<string, string> = {
  "assign:reviewer": "Reviewer assignment changed",
  "assign:seoReviewer": "SEO reviewer assignment changed",
  "assign:approver": "Approver assignment changed",
  setDeadline: "Review deadline updated",
  seoApprove: "SEO review — approved",
  seoRequestChanges: "SEO review — changes requested",
};

type HistoryEntry = {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  action: string;
  comment: string | null;
  createdAt: Date;
  actor: { name: string | null; email: string | null; role: string };
};

interface WorkflowPanelProps {
  contentType: "POST" | "PAGE" | "CASE_STUDY";
  contentId: string;
  status: Status;
  onTransition: (id: string, action: WorkflowAction, comment?: string) => Promise<{ success: boolean; error?: string; data?: { status?: Status } }>;
  onStatusChange?: (newStatus: Status) => void;
}

export default function WorkflowPanel({ contentType, contentId, status, onTransition, onStatusChange }: WorkflowPanelProps) {
  const [pendingAction, setPendingAction] = useState<ActionDef | null>(null);
  const [comment, setComment] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const currentStatus = STATUS_LABEL[status];
  const actions = ACTIONS_BY_STATUS[status] || [];

  const loadHistory = async () => {
    setShowHistory((prev) => !prev);
    if (history === null) {
      const data = await getContentApprovalHistory(contentType, contentId);
      setHistory(data as unknown as HistoryEntry[]);
    }
  };

  const runAction = async (def: ActionDef, commentText?: string) => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await onTransition(contentId, def.action, commentText);
      if (result.success) {
        setPendingAction(null);
        setComment("");
        setHistory(null);
        if (onStatusChange && result.data?.status) {
          onStatusChange(result.data.status);
        }
      } else {
        setError(result.error || "Action failed");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleClick = (def: ActionDef) => {
    if (def.needsComment) {
      setPendingAction(def);
      setComment("");
      setError(null);
      return;
    }
    runAction(def);
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Status &amp; Workflow</h2>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentStatus.className}`}>
          {currentStatus.label}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((def) => {
          const Icon = def.icon;
          return (
            <button
              key={def.action}
              type="button"
              disabled={isRunning}
              onClick={() => handleClick(def)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                def.danger
                  ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                  : "bg-background text-foreground border border-border hover:bg-tint"
              }`}
            >
              <Icon size={16} />
              {def.label}
            </button>
          );
        })}
        {actions.length === 0 && (
          <p className="text-sm text-caption">No actions available from this status.</p>
        )}
      </div>

      {pendingAction && (
        <div className="space-y-2 p-4 rounded-lg border border-border bg-background">
          <label className="block text-sm font-medium text-muted">
            Comment {pendingAction.needsComment && <span className="text-red-500">(required)</span>}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`Why are you ${pendingAction.label.toLowerCase()}ing this?`}
            className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-brand-orange"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isRunning || !comment.trim()}
              onClick={() => runAction(pendingAction, comment)}
              className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
            >
              Confirm {pendingAction.label}
            </button>
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={loadHistory}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <History size={14} />
        {showHistory ? "Hide" : "Show"} approval history
      </button>

      {showHistory && (
        <div className="space-y-2 border-t border-border pt-4">
          {history === null ? (
            <p className="text-sm text-caption">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-caption">No status changes yet.</p>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="text-sm border-l-2 border-border pl-3 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">
                    {entry.actor.name || entry.actor.email} ({entry.actor.role})
                  </span>
                  <span className="text-caption">
                    {NON_TRANSITION_LABEL[entry.action] || (
                      <>
                        {entry.fromStatus ? `${STATUS_LABEL[entry.fromStatus].label} → ` : ""}
                        {STATUS_LABEL[entry.toStatus].label}
                      </>
                    )}
                  </span>
                  <span className="text-caption text-xs">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                {entry.comment && <p className="text-caption mt-1 italic">&ldquo;{entry.comment}&rdquo;</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
