"use client";

import { useEffect, useState } from "react";
import { scheduleContentJob, cancelContentScheduledJob, getContentScheduledJobs } from "@/app/(admin)/actions/scheduling";
import { listTimezones } from "@/lib/scheduling";
import { CalendarClock, EyeOff, X, AlertTriangle } from "lucide-react";

const TIMEZONES = listTimezones();
const BROWSER_TIMEZONE = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

type ContentType = "POST" | "PAGE" | "CASE_STUDY";

type JobEntry = {
  id: string;
  jobType: "PUBLISH" | "UNPUBLISH" | "UPDATE";
  runAt: string | Date;
  timezone: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  attempts: number;
  lastError: string | null;
};

const JOB_LABEL: Record<JobEntry["jobType"], string> = {
  PUBLISH: "Publish",
  UNPUBLISH: "Unpublish",
  UPDATE: "Content update",
};

export default function SchedulingPanel({ contentType, contentId }: { contentType: ContentType; contentId: string }) {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [showUnpublishPicker, setShowUnpublishPicker] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState(BROWSER_TIMEZONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const data = await getContentScheduledJobs(contentType, contentId);
    setJobs(data as unknown as JobEntry[]);
  };

  useEffect(() => {
    getContentScheduledJobs(contentType, contentId).then((data) => setJobs(data as unknown as JobEntry[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScheduleUnpublish = async () => {
    if (!date || !time) return;
    setSaving(true);
    setError(null);
    try {
      const result = await scheduleContentJob(contentType, contentId, "UNPUBLISH", date, time, timezone);
      if (result.success) {
        setShowUnpublishPicker(false);
        setDate("");
        await refresh();
      } else {
        setError(result.error || "Failed to schedule unpublish");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this scheduled action?")) return;
    const result = await cancelContentScheduledJob(id);
    if (result.success) {
      await refresh();
    } else {
      alert(result.error || "Failed to cancel");
    }
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Scheduling</h2>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 text-sm border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-caption flex-shrink-0" />
                <span className="font-medium text-foreground">{JOB_LABEL[job.jobType]}</span>
                <span className="text-caption">
                  {new Date(job.runAt).toLocaleString()} ({job.timezone})
                </span>
                {job.status === "FAILED" && (
                  <span className="flex items-center gap-1 text-red-600 text-xs">
                    <AlertTriangle size={12} /> Failed after {job.attempts} attempts
                  </span>
                )}
                {job.status === "PROCESSING" && <span className="text-caption text-xs">Running...</span>}
              </div>
              {(job.status === "PENDING" || job.status === "FAILED") && (
                <button type="button" onClick={() => handleCancel(job.id)} className="text-caption hover:text-red-600 flex-shrink-0">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!showUnpublishPicker ? (
        <button
          type="button"
          onClick={() => setShowUnpublishPicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-background"
        >
          <EyeOff size={16} />
          Schedule Unpublish Date
        </button>
      ) : (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-background">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !date || !time}
              onClick={handleScheduleUnpublish}
              className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
            >
              {saving ? "Saving..." : "Confirm Unpublish Date"}
            </button>
            <button
              type="button"
              onClick={() => setShowUnpublishPicker(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
