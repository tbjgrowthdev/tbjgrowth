"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCaseStudy, updateCaseStudy, transitionCaseStudy } from "@/app/(admin)/actions/cases";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import WorkflowPanel from "./WorkflowPanel";
import AssignmentPanel from "./AssignmentPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";
import SchedulingPanel from "./SchedulingPanel";
import ContentLockBanner from "./ContentLockBanner";
import dynamic from "next/dynamic";
import { scheduleContentJob } from "@/app/(admin)/actions/scheduling";
import { listTimezones } from "@/lib/scheduling";
import { slugify } from "@/lib/utils";
import { AlertCircle, X, CalendarClock } from "lucide-react";
import SeoPanel from "./SeoPanel";
import { parseSecondaryKeywords } from "@/lib/seo-fields";
import { buildAutoSchema } from "@/lib/schema-engine";
import ImageInput from "./Media/ImageInput";
import { withToast } from "@/lib/admin/toast";

const TIMEZONES = listTimezones();
const BROWSER_TIMEZONE = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

// Dynamically import TipTap so it doesn't cause SSR issues
const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

export default function CaseStudyForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lockedByOther, setLockedByOther] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalSlug = initialData?.slug || "";
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    clientName: initialData?.clientName || "",
    industry: initialData?.industry || "",
    serviceType: initialData?.serviceType || "",
    results: initialData?.results || "",
    content: initialData?.content || "",
    excerpt: initialData?.excerpt || "",
    websiteUrl: initialData?.websiteUrl || "",
    featuredImage: initialData?.featuredImage || "",
    featuredImageAlt: initialData?.featuredImageAlt || "",
    imageGallery: initialData?.imageGallery || [],
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
    isFeatured: initialData?.isFeatured ?? false,
  });

  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [changeSummary, setChangeSummary] = useState("");
  const [scheduleUpdate, setScheduleUpdate] = useState(false);
  const [scheduleUpdateDate, setScheduleUpdateDate] = useState("");
  const [scheduleUpdateTime, setScheduleUpdateTime] = useState("09:00");
  const [scheduleUpdateTimezone, setScheduleUpdateTimezone] = useState(BROWSER_TIMEZONE);
  const removeGalleryImage = (url: string) => {
    setFormData((prev) => ({ ...prev, imageGallery: prev.imageGallery.filter((u: string) => u !== url) }));
  };

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
        const jobResult = await withToast(scheduleContentJob(
          "CASE_STUDY",
          initialData.id,
          "UPDATE",
          scheduleUpdateDate,
          scheduleUpdateTime,
          scheduleUpdateTimezone,
          payload
        ), { success: "Scheduled", error: "Couldn't schedule" });
        if (jobResult.success) {
          router.push("/admin/cases");
          router.refresh();
        } else {
          setError(jobResult.error || "Failed to schedule update");
        }
        setLoading(false);
        return;
      }

      const result = isExisting
        ? await withToast(updateCaseStudy(initialData.id, { ...payload, changeSummary, expectedUpdatedAt: initialData.updatedAt }), { success: "Case study updated", error: "Couldn't update case study" })
        : await withToast(createCaseStudy({ ...payload, changeSummary }), { success: "Case study created", error: "Couldn't create case study" });

      if (result.success) {
        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await withToast(createRedirect({
            source: `/case-studies/${originalSlug}`,
            destination: `/case-studies/${formData.slug}`,
            statusCode: 301,
          }), { success: "Redirect created", error: "Couldn't create redirect" });
        }
        router.push("/admin/cases");
        router.refresh();
      } else {
        setError(result.error || "Failed to save case study");
      }
    } catch (err) {
      console.error("Failed to save case study", err);
      setError(err instanceof Error ? err.message : "Failed to save case study");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {initialData?.id && (
        <ContentLockBanner contentType="CASE_STUDY" contentId={initialData.id} onLockStateChange={setLockedByOther} />
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Client Name</label>
            <input
              type="text"
              required
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Industry</label>
            <input
              type="text"
              required
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Service Type</label>
            <input
              type="text"
              required
              value={formData.serviceType}
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Results Summary</label>
            <input
              type="text"
              value={formData.results}
              onChange={(e) => setFormData({ ...formData, results: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">
              Website URL <span className="text-caption font-normal">(optional — shown as a button on the case study page)</span>
            </label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
              placeholder="https://clientwebsite.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Excerpt</label>
          <textarea
            rows={3}
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        <ImageInput
          label="Featured Image"
          folder="Case Studies"
          value={formData.featuredImage}
          onChange={(url) => setFormData((prev) => ({ ...prev, featuredImage: url }))}
          altText={formData.featuredImageAlt}
          onAltTextChange={(alt) => setFormData((prev) => ({ ...prev, featuredImageAlt: alt }))}
          defaultAltText={formData.title}
          previewClassName="w-40 h-24"
        />

        <div className="space-y-2">
          <ImageInput
            label="Image Gallery"
            folder="Case Studies"
            defaultAltText={formData.title}
            placeholder="Paste an image URL and press Add, or use the options below"
            onAdd={(images) =>
              setFormData((prev) => ({
                ...prev,
                imageGallery: [...prev.imageGallery, ...images.map((i) => i.url).filter((url) => !prev.imageGallery.includes(url))],
              }))
            }
          />

          {formData.imageGallery.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-3">
              {formData.imageGallery.map((url: string) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Gallery item" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(url)}
                    className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {!initialData?.id && (
          <p className="text-sm text-caption bg-background border border-border rounded-lg px-4 py-2">
            New case studies are always created as a <strong>Draft</strong>. Submit it for review and publish from the workflow panel after saving.
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border mt-2 pt-4">
          <div>
            <label htmlFor="isFeatured" className="text-sm font-medium text-foreground">
              Show on Home Page
            </label>
            <p className="text-xs text-caption">
              Featured case studies appear in the Case Studies section on the home page.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.isFeatured}
            id="isFeatured"
            onClick={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              formData.isFeatured ? "bg-brand-orange-deep" : "bg-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                formData.isFeatured ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {initialData?.id && (
        <>
          <WorkflowPanel
            contentType="CASE_STUDY"
            contentId={initialData.id}
            status={status}
            onTransition={transitionCaseStudy}
            onStatusChange={setStatus}
          />
          <AssignmentPanel
            contentType="CASE_STUDY"
            contentId={initialData.id}
            authorId={initialData.authorId}
            reviewerId={initialData.reviewerId}
            seoReviewerId={initialData.seoReviewerId}
            approverId={initialData.approverId}
            reviewDeadline={initialData.reviewDeadline}
          />
          <SchedulingPanel contentType="CASE_STUDY" contentId={initialData.id} />
          <VersionHistoryPanel contentType="CASE_STUDY" contentId={initialData.id} />
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
        slugPreviewPath={`case-studies/${formData.slug}`}
        contentLabel="case study"
        autoSchema={buildAutoSchema({
          contentType: "CASE_STUDY",
          id: initialData?.id,
          title: formData.title,
          slug: formData.slug,
          excerpt: formData.excerpt,
          featuredImage: formData.featuredImage,
        })}
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
            ? "Update Case Study"
            : "Create Case Study"}
        </button>
      </div>
    </form>
  );
}
