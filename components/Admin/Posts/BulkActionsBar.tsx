"use client";

import { useState } from "react";
import {
  bulkChangeStatus,
  bulkSchedule,
  bulkAssignCategory,
  bulkAssignTags,
  bulkReassignAuthor,
  bulkUpdateSeo,
} from "@/app/(admin)/actions/bulk-posts";
import type { WorkflowAction } from "@/lib/workflow";
import { AlertTriangle, Tag, Folder, UserCog, Search, CalendarClock, Archive, X, Loader2 } from "lucide-react";

type Option = { id: string; label: string };

// Loosely shared shape across bulk-posts.ts's various return types — every
// one of them includes at least these two fields, which is all this
// component ever reads off the result.
type BulkResult = { success: boolean; error?: string };

// Status/schedule actions change what's live on the public site for every
// selected post at once, so they always go through the confirmation modal
// below — see handleRequestConfirm. Category/tag/author/SEO assignment are
// additive or scoped to a single non-visibility field, so they execute
// immediately from their own panel without a second confirmation step.
const STATUS_LABEL: Record<string, string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore to Draft",
};

type PanelKind = "category" | "tags" | "author" | "seo" | "schedule" | null;

export default function BulkActionsBar({
  selectedIds,
  onCleared,
  categories,
  tags,
  authors,
  canPublish,
  canSchedule,
  canEdit,
}: {
  selectedIds: string[];
  onCleared: () => void;
  categories: Option[];
  tags: Option[];
  authors: Option[];
  canPublish: boolean;
  canSchedule: boolean;
  canEdit: boolean;
}) {
  const [panel, setPanel] = useState<PanelKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; run: () => Promise<BulkResult> } | null>(null);

  // Form state for the open panel
  const [categoryId, setCategoryId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [authorId, setAuthorId] = useState("");
  const [isIndexable, setIsIndexable] = useState<"" | "true" | "false">("");
  const [twitterCard, setTwitterCard] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  if (selectedIds.length === 0) return null;

  const closePanel = () => {
    setPanel(null);
    setError(null);
    setCategoryId("");
    setTagIds([]);
    setAuthorId("");
    setIsIndexable("");
    setTwitterCard("");
    setDate("");
  };

  const run = async (action: () => Promise<BulkResult>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.success) {
        setError(result.error || "Action failed");
        return;
      }
      closePanel();
      setConfirmAction(null);
      onCleared();
    } finally {
      setBusy(false);
    }
  };

  const requestStatusChange = (action: WorkflowAction) => {
    setConfirmAction({
      label: `${STATUS_LABEL[action]} ${selectedIds.length} post${selectedIds.length === 1 ? "" : "s"}? This changes what's visible on the live site.`,
      run: () => bulkChangeStatus(selectedIds, action),
    });
  };

  const requestSchedule = () => {
    if (!date) {
      setError("Pick a date");
      return;
    }
    setConfirmAction({
      label: `Schedule ${selectedIds.length} post${selectedIds.length === 1 ? "" : "s"} to publish on ${date} at ${time} (${timezone})?`,
      run: () => bulkSchedule(selectedIds, date, time, timezone),
    });
  };

  return (
    <div className="sticky top-0 z-10 bg-card border border-border rounded-lg shadow-sm p-3 mb-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-foreground">{selectedIds.length} selected</span>
        <button onClick={onCleared} className="text-xs text-caption hover:text-foreground underline">
          Clear
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <>
              <ActionButton icon={Folder} label="Assign Category" active={panel === "category"} onClick={() => setPanel(panel === "category" ? null : "category")} />
              <ActionButton icon={Tag} label="Assign Tags" active={panel === "tags"} onClick={() => setPanel(panel === "tags" ? null : "tags")} />
              <ActionButton icon={UserCog} label="Edit Metadata" active={panel === "author"} onClick={() => setPanel(panel === "author" ? null : "author")} />
              <ActionButton icon={Search} label="SEO Updates" active={panel === "seo"} onClick={() => setPanel(panel === "seo" ? null : "seo")} />
            </>
          )}
          {canSchedule && (
            <ActionButton icon={CalendarClock} label="Schedule" active={panel === "schedule"} onClick={() => setPanel(panel === "schedule" ? null : "schedule")} />
          )}
          {canPublish && (
            <>
              <ActionButton icon={Archive} label="Archive" onClick={() => requestStatusChange("archive")} />
              <select
                className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) requestStatusChange(e.target.value as WorkflowAction);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Change status...
                </option>
                <option value="publish">Publish</option>
                <option value="unpublish">Unpublish</option>
                <option value="restore">Restore to Draft</option>
              </select>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {panel === "category" && (
        <Panel onClose={closePanel}>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="flex-1 border border-border rounded-md px-3 py-2 bg-background text-sm">
            <option value="">Select a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <SubmitButton disabled={!categoryId || busy} onClick={() => run(() => bulkAssignCategory(selectedIds, categoryId))} busy={busy} label="Assign" />
        </Panel>
      )}

      {panel === "tags" && (
        <Panel onClose={closePanel}>
          <div className="flex-1 flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-thin">
            {tags.map((t) => {
              const checked = tagIds.includes(t.id);
              return (
                <label key={t.id} className={`text-xs px-2 py-1 rounded-full border cursor-pointer ${checked ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => setTagIds((prev) => (checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]))}
                  />
                  {t.label}
                </label>
              );
            })}
          </div>
          <SubmitButton disabled={tagIds.length === 0 || busy} onClick={() => run(() => bulkAssignTags(selectedIds, tagIds))} busy={busy} label="Assign" />
        </Panel>
      )}

      {panel === "author" && (
        <Panel onClose={closePanel}>
          <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className="flex-1 border border-border rounded-md px-3 py-2 bg-background text-sm">
            <option value="">Reassign author to...</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <SubmitButton disabled={!authorId || busy} onClick={() => run(() => bulkReassignAuthor(selectedIds, authorId))} busy={busy} label="Reassign" />
        </Panel>
      )}

      {panel === "seo" && (
        <Panel onClose={closePanel}>
          <select
            value={isIndexable}
            onChange={(e) => setIsIndexable(e.target.value as "" | "true" | "false")}
            className="border border-border rounded-md px-3 py-2 bg-background text-sm"
          >
            <option value="">Indexable: no change</option>
            <option value="true">Set indexable: Yes</option>
            <option value="false">Set indexable: No (noindex)</option>
          </select>
          <select value={twitterCard} onChange={(e) => setTwitterCard(e.target.value)} className="border border-border rounded-md px-3 py-2 bg-background text-sm">
            <option value="">Twitter card: no change</option>
            <option value="summary">summary</option>
            <option value="summary_large_image">summary_large_image</option>
          </select>
          <SubmitButton
            disabled={(!isIndexable && !twitterCard) || busy}
            onClick={() =>
              run(() =>
                bulkUpdateSeo(selectedIds, {
                  isIndexable: isIndexable === "" ? undefined : isIndexable === "true",
                  twitterCard: twitterCard || undefined,
                })
              )
            }
            busy={busy}
            label="Update"
          />
        </Panel>
      )}

      {panel === "schedule" && (
        <Panel onClose={closePanel}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-border rounded-md px-3 py-2 bg-background text-sm" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="border border-border rounded-md px-3 py-2 bg-background text-sm" />
          <span className="text-xs text-caption self-center">{timezone}</span>
          <SubmitButton disabled={!date || busy} onClick={requestSchedule} busy={busy} label="Schedule" />
        </Panel>
      )}

      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-500" />
              <h2 className="text-lg font-semibold text-foreground">Confirm bulk action</h2>
            </div>
            <p className="text-sm text-caption">{confirmAction.label}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setConfirmAction(null)} className="px-4 py-2 border border-border rounded-lg hover:bg-background text-sm">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(confirmAction.run)}
                className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm flex items-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, active }: { icon: typeof Tag; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
        active ? "bg-tint border-brand-orange-deep text-brand-orange-deep" : "border-border text-caption hover:bg-tint hover:text-foreground"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap bg-background rounded-md p-3 border border-border">
      {children}
      <button onClick={onClose} className="ml-auto text-caption hover:text-foreground">
        <X size={16} />
      </button>
    </div>
  );
}

function SubmitButton({ disabled, onClick, busy, label }: { disabled: boolean; onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs px-3 py-2 bg-brand-orange-deep text-white rounded-md hover:bg-brand-orange disabled:opacity-50"
    >
      {busy && <Loader2 size={12} className="animate-spin" />}
      {label}
    </button>
  );
}
