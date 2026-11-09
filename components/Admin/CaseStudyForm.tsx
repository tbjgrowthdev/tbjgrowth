"use client";
import { confirmDialog } from "@/lib/admin/dialog";

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
import { AlertCircle, X, CalendarClock, FileJson } from "lucide-react";
import SeoPanel from "./SeoPanel";
import { parseSecondaryKeywords } from "@/lib/seo-fields";
import { buildAutoSchema } from "@/lib/schema-engine";
import ImageInput from "./Media/ImageInput";
import { withToast } from "@/lib/admin/toast";
import BlocksEditor, { readBlocks, type EditableBlock } from "./Blocks/BlocksEditor";
import ImportBlocksDialog, { type ImportApplied, type SlugConflict } from "./Blocks/ImportBlocksDialog";
import { blocksToText } from "@/lib/blocks/text";

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

  // "blocks" = block layout (CaseStudy.blocks); "classic" = the single rich-text Content field. `content` is kept either
  // way. Saving in classic mode clears the block layout (the case study then renders `content` as before).
  const initialBlocks = readBlocks(initialData?.blocks);
  const [layout, setLayout] = useState<"classic" | "blocks">(initialBlocks.length > 0 ? "blocks" : "classic");
  const [blocks, setBlocks] = useState<EditableBlock[]>(initialBlocks);
  // "Import JSON" can fill the whole form. importVersion remounts the editors that only read their initial value
  // (TipTap, the schema builder) so imported text shows up; slugConflict is the "already exists" notice.
  const [importing, setImporting] = useState(false);
  const [importVersion, setImportVersion] = useState(0);
  const [slugConflict, setSlugConflict] = useState<SlugConflict | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [changeSummary, setChangeSummary] = useState("");
  const [scheduleUpdate, setScheduleUpdate] = useState(false);
  const [scheduleUpdateDate, setScheduleUpdateDate] = useState("");
  const [scheduleUpdateTime, setScheduleUpdateTime] = useState("09:00");
  const [scheduleUpdateTimezone, setScheduleUpdateTimezone] = useState(BROWSER_TIMEZONE);
  const removeGalleryImage = (url: string) => {
    setFormData((prev) => ({ ...prev, imageGallery: prev.imageGallery.filter((u: string) => u !== url) }));
  };

  const applyImport = (applied: ImportApplied) => {
    const parts: string[] = [];
    if (applied.fields && Object.keys(applied.fields).length) {
      // Status is never part of an import; only form fields reach formData.
      setFormData((prev) => ({ ...prev, ...applied.fields }));
      parts.push(`${Object.keys(applied.fields).length} field${Object.keys(applied.fields).length === 1 ? "" : "s"}`);
    }
    if (applied.blocks) {
      setBlocks(applied.blocks);
      setLayout("blocks");
      parts.push(`${applied.blocks.length} block${applied.blocks.length === 1 ? "" : "s"}`);
    }
    setSlugConflict(applied.slugConflict ?? null);
    setImportVersion((v) => v + 1);
    setImportNote(`Imported ${parts.join(" and ")} into the form. Nothing is saved yet — review, then save.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;
      const payload = { ...formData, secondaryKeywords: JSON.stringify(formData.secondaryKeywords), blocks: layout === "blocks" ? blocks : [] };

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
        if (slugChanged && await confirmDialog({ title: "Create a 301 redirect?", text: `The URL slug changed from "${originalSlug}" to "${formData.slug}".

Create a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`, confirmText: "Create redirect", cancelText: "Skip" })) {
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

      {importNote && (
        <div role="status" className="bg-tint text-foreground p-4 rounded-lg flex items-center justify-between gap-3 text-sm">
          <span>{importNote}</span>
          <button type="button" onClick={() => setImportNote(null)} aria-label="Dismiss" className="text-caption hover:text-foreground"><X size={16} /></button>
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
              onChange={(e) => { setSlugConflict(null); setFormData({ ...formData, slug: e.target.value }); }}
              onBlur={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
            {slugConflict && (
              <p role="alert" className="text-sm text-red-600">
                A case study with this slug already exists (“{slugConflict.title}”). Saving will fail until you change it.
              </p>
            )}
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold text-foreground">Content</h2>
          <button type="button" onClick={() => setImporting(true)} className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-tint">
            <FileJson size={14} /> Import JSON
          </button>
          <div role="radiogroup" aria-label="Case study layout" className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
            {(["classic", "blocks"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={layout === mode}
                onClick={() => {
                  // First switch to blocks on a case study that has classic content: carry that content over as a rich-text block.
                  if (mode === "blocks" && blocks.length === 0 && formData.content.trim()) {
                    setBlocks([{ id: `b_${Date.now().toString(36)}`, type: "richText", data: { html: formData.content } }]);
                  }
                  setLayout(mode);
                }}
                className={`px-4 py-1.5 ${layout === mode ? "bg-brand-orange-deep text-white" : "bg-card text-muted hover:bg-tint"}`}
              >
                {mode === "classic" ? "Classic text" : "Blocks"}
              </button>
            ))}
          </div>
        </div>
        {layout === "blocks" ? (
          <>
            <p className="text-sm text-caption">
              Build the case study from blocks: headline metric, facts, tables, proof images, quote, takeaway and more — or use Import JSON.
              The title, client, results summary and excerpt above are still shown at the top. Switching back to &ldquo;Classic text&rdquo; and
              saving removes this layout (it stays in version history, and the classic text is kept as it was).
            </p>
            <BlocksEditor value={blocks} onChange={setBlocks} showImport={false} />
          </>
        ) : (
          <RichTextEditor
            key={importVersion}
            content={formData.content}
            onChange={(content) => setFormData({ ...formData, content })}
          />
        )}
      </div>

      <SeoPanel
        key={importVersion}
        data={formData}
        onChange={(field, value) => setFormData({ ...formData, [field]: value })}
        secondaryKeywords={formData.secondaryKeywords}
        onSecondaryKeywordsChange={(secondaryKeywords) => setFormData({ ...formData, secondaryKeywords })}
        content={layout === "blocks" ? blocksToText(blocks) : formData.content}
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

      {importing && (
        <ImportBlocksDialog
          target="caseStudy"
          existing={blocks}
          currentFields={formData}
          currentId={initialData?.id}
          onImport={applyImport}
          onClose={() => setImporting(false)}
        />
      )}
    </form>
  );
}
