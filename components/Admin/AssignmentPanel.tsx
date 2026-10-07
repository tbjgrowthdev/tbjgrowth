"use client";

import { useEffect, useState } from "react";
import { getAssignableUsers } from "@/app/(admin)/actions/admins";
import { assignContentUser, setContentReviewDeadline, submitSeoReview } from "@/app/(admin)/actions/workflow";
import type { AssignmentRole } from "@/lib/workflow";
import { UserCheck, CalendarClock, Search, ThumbsUp, ThumbsDown } from "lucide-react";

type ContentType = "POST" | "PAGE" | "CASE_STUDY";
type TeamMember = { id: string; name: string | null; email: string | null; role: string };

interface AssignmentPanelProps {
  contentType: ContentType;
  contentId: string;
  authorId?: string | null;
  reviewerId?: string | null;
  seoReviewerId?: string | null;
  approverId?: string | null;
  reviewDeadline?: string | Date | null;
}

function displayName(user: TeamMember | undefined) {
  if (!user) return "Unassigned";
  return user.name || user.email || "Unknown";
}

export default function AssignmentPanel({
  contentType,
  contentId,
  authorId,
  reviewerId: initialReviewerId,
  seoReviewerId: initialSeoReviewerId,
  approverId: initialApproverId,
  reviewDeadline: initialDeadline,
}: AssignmentPanelProps) {
  const [everyone, setEveryone] = useState<TeamMember[]>([]);
  const [reviewerPool, setReviewerPool] = useState<TeamMember[]>([]);
  const [seoPool, setSeoPool] = useState<TeamMember[]>([]);
  const [reviewerId, setReviewerId] = useState(initialReviewerId || "");
  const [seoReviewerId, setSeoReviewerId] = useState(initialSeoReviewerId || "");
  const [approverId, setApproverId] = useState(initialApproverId || "");
  const [deadline, setDeadline] = useState(
    initialDeadline ? new Date(initialDeadline).toISOString().slice(0, 10) : ""
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [seoComment, setSeoComment] = useState("");
  const [seoMessage, setSeoMessage] = useState<string | null>(null);

  useEffect(() => {
    getAssignableUsers("VIEW").then((users) => setEveryone(users as TeamMember[]));
    getAssignableUsers("APPROVE").then((users) => setReviewerPool(users as TeamMember[]));
    getAssignableUsers("SEO_MANAGEMENT").then((users) => setSeoPool(users as TeamMember[]));
  }, []);

  const author = everyone.find((u) => u.id === authorId);

  const handleAssign = async (role: AssignmentRole, userId: string, setter: (v: string) => void) => {
    setter(userId);
    setSaving(role);
    try {
      const result = await assignContentUser(contentType, contentId, role, userId || null);
      if (!result.success) alert(result.error || "Failed to assign");
    } finally {
      setSaving(null);
    }
  };

  const handleDeadline = async (value: string) => {
    setDeadline(value);
    setSaving("deadline");
    try {
      const result = await setContentReviewDeadline(contentType, contentId, value || null);
      if (!result.success) alert(result.error || "Failed to set deadline");
    } finally {
      setSaving(null);
    }
  };

  const handleSeoReview = async (approved: boolean) => {
    if (!approved && !seoComment.trim()) {
      alert("Add a comment describing the SEO issue first.");
      return;
    }
    setSaving("seo");
    try {
      const result = await submitSeoReview(contentType, contentId, approved, seoComment || undefined);
      setSeoMessage(result.success ? (approved ? "SEO approved." : "SEO changes requested.") : result.error || "Failed");
      if (result.success) setSeoComment("");
    } finally {
      setSaving(null);
    }
  };

  const isOverdue = deadline && new Date(deadline) < new Date();

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-5">
      <h2 className="text-xl font-semibold text-foreground">Approval Assignment</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted flex items-center gap-1.5">
            <UserCheck size={14} /> Author
          </label>
          <p className="text-sm text-foreground px-3 py-2 bg-background border border-border rounded-lg">
            {displayName(author)}
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted">Reviewer</label>
          <select
            value={reviewerId}
            disabled={saving === "reviewer"}
            onChange={(e) => handleAssign("reviewer", e.target.value, setReviewerId)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {reviewerPool.map((u) => (
              <option key={u.id} value={u.id}>{displayName(u)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted flex items-center gap-1.5">
            <Search size={14} /> SEO Reviewer
          </label>
          <select
            value={seoReviewerId}
            disabled={saving === "seoReviewer"}
            onChange={(e) => handleAssign("seoReviewer", e.target.value, setSeoReviewerId)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {seoPool.map((u) => (
              <option key={u.id} value={u.id}>{displayName(u)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-muted">Approver</label>
          <select
            value={approverId}
            disabled={saving === "approver"}
            onChange={(e) => handleAssign("approver", e.target.value, setApproverId)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {reviewerPool.map((u) => (
              <option key={u.id} value={u.id}>{displayName(u)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-muted flex items-center gap-1.5">
          <CalendarClock size={14} /> Review Deadline
        </label>
        <input
          type="date"
          value={deadline}
          disabled={saving === "deadline"}
          onChange={(e) => handleDeadline(e.target.value)}
          className={`px-3 py-2 border rounded-lg bg-background text-foreground text-sm disabled:opacity-50 ${
            isOverdue ? "border-red-400 text-red-600" : "border-border"
          }`}
        />
        {isOverdue && <p className="text-xs text-red-600">Overdue</p>}
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <label className="block text-sm font-medium text-muted flex items-center gap-1.5">
          <Search size={14} /> SEO Review (independent of main approval)
        </label>
        <textarea
          rows={2}
          value={seoComment}
          onChange={(e) => setSeoComment(e.target.value)}
          placeholder="Notes or required fixes (required if flagging issues)"
          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving === "seo"}
            onClick={() => handleSeoReview(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 disabled:opacity-50"
          >
            <ThumbsUp size={14} /> SEO Approve
          </button>
          <button
            type="button"
            disabled={saving === "seo"}
            onClick={() => handleSeoReview(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 disabled:opacity-50"
          >
            <ThumbsDown size={14} /> Flag SEO Issues
          </button>
        </div>
        {seoMessage && <p className="text-xs text-caption">{seoMessage}</p>}
      </div>
    </div>
  );
}
