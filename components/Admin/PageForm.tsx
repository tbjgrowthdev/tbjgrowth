"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPage, updatePage, transitionPage } from "@/app/(admin)/actions/pages";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import dynamic from "next/dynamic";
import { slugify } from "@/lib/utils";
import { AlertCircle, CalendarClock } from "lucide-react";
import SeoPanel from "./SeoPanel";
import { parseSecondaryKeywords } from "@/lib/seo-fields";
import WorkflowPanel from "./WorkflowPanel";
import AssignmentPanel from "./AssignmentPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";
import SchedulingPanel from "./SchedulingPanel";
import ContentLockBanner from "./ContentLockBanner";
import { scheduleContentJob } from "@/app/(admin)/actions/scheduling";
import { listTimezones } from "@/lib/scheduling";

const TIMEZONES = listTimezones();
const BROWSER_TIMEZONE = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

// Dynamically import TipTap so it doesn't cause SSR issues
const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

export default function PageForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lockedByOther, setLockedByOther] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalSlug = initialData?.slug || "";
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    content: initialData?.content || "",
    metaTitle: initialData?.metaTitle || "",
    metaDescription: initialData?.metaDescription || "",
    focusKeyword: initialData?.focusKeyword || "",
    secondaryKeywords: parseSecondaryKeywords(initialData?.secondaryKeywords),
    canonicalUrl: initialData?.canonicalUrl || "",
    twitterCard: initialData?.twitterCard || "",
    ogImage: initialData?.ogImage || "",
    ogTitle: initialData?.ogTitle || "",
    ogDescription: initialData?.ogDescription || "",
    twitterTitle: initialData?.twitterTitle || "",
    twitterDescription: initialData?.twitterDescription || "",
    twitterImage: initialData?.twitterImage || "",
    schemaJson: initialData?.schemaJson || "",
    isIndexable: initialData?.isIndexable ?? true,
    allowFollow: initialData?.allowFollow ?? true,
    maxSnippet: initialData?.maxSnippet ?? -1,
    maxImagePreview: initialData?.maxImagePreview || "large",
    maxVideoPreview: initialData?.maxVideoPreview ?? -1,
  });
  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [changeSummary, setChangeSummary] = useState("");
  const [scheduleUpdate, setScheduleUpdate] = useState(false);
  const [scheduleUpdateDate, setScheduleUpdateDate] = useState("");
  const [scheduleUpdateTime, setScheduleUpdateTime] = useState("09:00");
  const [scheduleUpdateTimezone, setScheduleUpdateTimezone] = useState(BROWSER_TIMEZONE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;
      const payload = { ...formData, secondaryKeywords: JSON.stringify(formData.secondaryKeywords) };

      if (isExisting && scheduleUpdate) {
        if (!scheduleUpdateDate || !scheduleUpdateTime) {
          setError("Pick a date and time for the scheduled update");
          setLoading(false);
          return;
        }
        const jobResult = await scheduleContentJob(
          "PAGE",
          initialData.id,
          "UPDATE",
          scheduleUpdateDate,
          scheduleUpdateTime,
          scheduleUpdateTimezone,
          payload
        );
        if (jobResult.success) {
          router.push("/admin/pages");
          router.refresh();
        } else {
          setError(jobResult.error || "Failed to schedule update");
        }
        setLoading(false);
        return;
      }

      const result = isExisting
        ? await updatePage(initialData.id, { ...payload, changeSummary, expectedUpdatedAt: initialData.updatedAt })
        : await createPage({ ...payload, changeSummary });

      if (result.success) {
        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await createRedirect({
            source: `/${originalSlug}`,
            destination: `/${formData.slug}`,
            statusCode: 301,
          });
        }
        router.push("/admin/pages");
        router.refresh();
      } else {
        setError(result.error || "Failed to save page");
      }
    } catch (err) {
      console.error("Failed to save page", err);
      setError(err instanceof Error ? err.message : "Failed to save page");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {initialData?.id && (
        <ContentLockBanner contentType="PAGE" contentId={initialData.id} onLockStateChange={setLockedByOther} />
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Slug</label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              onBlur={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>

        {!initialData?.id && (
          <p className="text-sm text-caption bg-background border border-border rounded-lg px-4 py-2">
            New pages are always created as a <strong>Draft</strong>. Submit it for review and publish from the workflow panel after saving.
          </p>
        )}

      </div>

      {initialData?.id && (
        <>
          <WorkflowPanel
            contentType="PAGE"
            contentId={initialData.id}
            status={status}
            onTransition={transitionPage}
            onStatusChange={setStatus}
          />
          <AssignmentPanel
            contentType="PAGE"
            contentId={initialData.id}
            authorId={initialData.authorId}
            reviewerId={initialData.reviewerId}
            seoReviewerId={initialData.seoReviewerId}
            approverId={initialData.approverId}
            reviewDeadline={initialData.reviewDeadline}
          />
          <SchedulingPanel contentType="PAGE" contentId={initialData.id} />
          <VersionHistoryPanel contentType="PAGE" contentId={initialData.id} />
        </>
      )}

      {/* Editor */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-4">
        <h2 className="text-xl font-semibold text-foreground mb-4">Content</h2>
        <RichTextEditor
          content={formData.content} 
          onChange={(content) => setFormData({ ...formData, content })} 
        />
      </div>

      <SeoPanel
        data={formData}
        onChange={(field, value) => setFormData({ ...formData, [field]: value })}
        secondaryKeywords={formData.secondaryKeywords}
        onSecondaryKeywordsChange={(secondaryKeywords) => setFormData({ ...formData, secondaryKeywords })}
        content={formData.content}
        slugPreviewPath={formData.slug}
        contentLabel="page"
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted">Change Summary (optional)</label>
        <input
          type="text"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          placeholder="What changed in this save?"
          className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
        />
      </div>

      {initialData?.id && (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-card">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={scheduleUpdate}
              onChange={(e) => setScheduleUpdate(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <CalendarClock size={16} />
            Schedule this update for later instead of saving now
          </label>
          {scheduleUpdate && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleUpdateDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setScheduleUpdateDate(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleUpdateTime}
                  onChange={(e) => setScheduleUpdateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Timezone</label>
                <select
                  value={scheduleUpdateTimezone}
                  onChange={(e) => setScheduleUpdateTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 border border-border rounded-lg hover:bg-background"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || lockedByOther}
          title={lockedByOther ? "Someone else is currently editing this — take over editing to save" : undefined}
          className="px-6 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50"
        >
          {loading
            ? "Saving..."
            : scheduleUpdate
            ? "Schedule Update"
            : initialData
            ? "Update Page"
            : "Create Page"}
        </button>
      </div>
    </form>
  );
}
