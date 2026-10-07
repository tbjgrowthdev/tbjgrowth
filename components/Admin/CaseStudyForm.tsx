"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCaseStudy, updateCaseStudy, transitionCaseStudy } from "@/app/(admin)/actions/cases";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import WorkflowPanel from "./WorkflowPanel";
import AssignmentPanel from "./AssignmentPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";
import dynamic from "next/dynamic";
import { uploadMediaAsset } from "@/app/(admin)/actions/media";
import { slugify } from "@/lib/utils";
import { AlertCircle, X, Upload, FolderOpen } from "lucide-react";
import SERPPreview from "./SERPPreview";
import SEOScorePanel from "./SEOScorePanel";
import SchemaBuilder from "./SchemaBuilder";
import SocialSeoFields from "./SocialSeoFields";
import MediaAssetPicker from "./Media/MediaAssetPicker";

// Dynamically import TipTap so it doesn't cause SSR issues
const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

export default function CaseStudyForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    isFeatured: initialData?.isFeatured ?? false,
  });

  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [changeSummary, setChangeSummary] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingAltText, setPendingAltText] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [pendingGallery, setPendingGallery] = useState<{ file: File; previewUrl: string; altText: string }[]>([]);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setPendingAltText(formData.featuredImageAlt || "");
    setUploadError("");
  };

  const handleCancelPending = () => {
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingAltText("");
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile || !pendingAltText.trim()) return;
    setUploadingImage(true);
    setUploadError("");
    try {
      const result = await uploadMediaAsset(pendingFile, { altText: pendingAltText, folder: "Case Studies" });
      if (result.success && result.url) {
        setFormData({ ...formData, featuredImage: result.url, featuredImageAlt: pendingAltText });
        handleCancelPending();
      } else {
        setUploadError(result.error || "Image upload failed");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGalleryFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newEntries = Array.from(files).map((file) => ({ file, previewUrl: URL.createObjectURL(file), altText: "" }));
    setPendingGallery((prev) => [...prev, ...newEntries]);
    e.target.value = "";
  };

  const updatePendingGalleryAlt = (index: number, altText: string) => {
    setPendingGallery((prev) => prev.map((entry, i) => (i === index ? { ...entry, altText } : entry)));
  };

  const removePendingGalleryEntry = (index: number) => {
    setPendingGallery((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmGalleryUpload = async () => {
    if (pendingGallery.length === 0 || pendingGallery.some((entry) => !entry.altText.trim())) return;
    setUploadingGallery(true);
    setUploadError("");
    try {
      const results = await Promise.all(
        pendingGallery.map((entry) => uploadMediaAsset(entry.file, { altText: entry.altText, folder: "Case Studies" }))
      );
      const failed = results.find((r) => !r.success);
      if (failed) {
        setUploadError(failed.error || "Gallery upload failed");
        return;
      }
      const urls = results.map((r) => r.url!);
      setFormData((prev) => ({ ...prev, imageGallery: [...prev.imageGallery, ...urls] }));
      setPendingGallery([]);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Gallery upload failed");
    } finally {
      setUploadingGallery(false);
    }
  };

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

      const result = isExisting
        ? await updateCaseStudy(initialData.id, { ...formData, changeSummary })
        : await createCaseStudy({ ...formData, changeSummary });

      if (result.success) {
        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await createRedirect({
            source: `/case-studies/${originalSlug}`,
            destination: `/case-studies/${formData.slug}`,
            permanent: true,
          });
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

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Featured Image</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelected}
              disabled={uploadingImage}
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowMediaPicker(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-background whitespace-nowrap"
            >
              <FolderOpen size={16} />
              Choose from Library
            </button>
          </div>
          {uploadError && (
            <div className="mt-2 text-sm text-red-600">{uploadError}</div>
          )}

          {pendingPreviewUrl && (
            <div className="mt-2 space-y-2 p-4 border border-border rounded-lg bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingPreviewUrl} alt="Preview" className="h-32 object-contain" />
              <label className="block text-sm font-medium text-muted">
                Alt Text <span className="text-red-500">(required to upload)</span>
              </label>
              <input
                type="text"
                value={pendingAltText}
                onChange={(e) => setPendingAltText(e.target.value)}
                placeholder="Describe the image for accessibility & image SEO"
                className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-brand-orange"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={uploadingImage || !pendingAltText.trim()}
                  onClick={handleConfirmUpload}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
                >
                  <Upload size={16} />
                  {uploadingImage ? "Uploading..." : "Upload image"}
                </button>
                <button type="button" onClick={handleCancelPending} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {formData.featuredImage && !pendingPreviewUrl && (
            <div className="mt-2 text-sm text-caption">
              Image set (URL: {formData.featuredImage})
            </div>
          )}
        </div>

        {showMediaPicker && (
          <MediaAssetPicker
            onClose={() => setShowMediaPicker(false)}
            onSelect={({ url, altText }) => {
              setFormData({ ...formData, featuredImage: url, featuredImageAlt: altText });
              setShowMediaPicker(false);
            }}
          />
        )}

        {formData.featuredImage && !pendingPreviewUrl && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Featured Image Alt Text</label>
            <input
              type="text"
              value={formData.featuredImageAlt}
              onChange={(e) => setFormData({ ...formData, featuredImageAlt: e.target.value })}
              placeholder="Describe the image for accessibility & image SEO"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Image Gallery</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleGalleryFilesSelected}
            disabled={uploadingGallery}
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50"
          />

          {pendingGallery.length > 0 && (
            <div className="space-y-3 mt-3 p-4 border border-border rounded-lg bg-background">
              {pendingGallery.map((entry, index) => (
                <div key={index} className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.previewUrl} alt="Pending gallery item" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={entry.altText}
                      onChange={(e) => updatePendingGalleryAlt(index, e.target.value)}
                      placeholder="Alt text (required)"
                      className="w-full px-3 py-1.5 border border-border rounded-lg bg-card text-foreground text-sm"
                    />
                  </div>
                  <button type="button" onClick={() => removePendingGalleryEntry(index)} className="text-caption hover:text-red-600 flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploadingGallery || pendingGallery.some((e) => !e.altText.trim())}
                onClick={handleConfirmGalleryUpload}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
              >
                <Upload size={16} />
                {uploadingGallery ? "Uploading..." : `Upload ${pendingGallery.length} image${pendingGallery.length > 1 ? "s" : ""}`}
              </button>
            </div>
          )}

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

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isIndexable"
            checked={formData.isIndexable}
            onChange={(e) => setFormData({ ...formData, isIndexable: e.target.checked })}
            className="w-4 h-4 rounded border-border"
          />
          <label htmlFor="isIndexable" className="text-sm text-muted">
            Allow search engines to index this case study (unchecking sets meta robots to noindex)
          </label>
        </div>

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

      {/* SEO Settings */}
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">SEO Settings</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Meta Title</label>
              <input
                type="text"
                value={formData.metaTitle}
                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Meta Description</label>
              <textarea
                rows={3}
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Focus Keyword</label>
              <input
                type="text"
                value={formData.focusKeyword}
                onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Canonical URL</label>
              <input
                type="text"
                value={formData.canonicalUrl}
                onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange"
                placeholder="https://example.com/canonical-url"
              />
            </div>

          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Live SERP Preview</label>
              <SERPPreview
                title={formData.metaTitle}
                description={formData.metaDescription}
                slug={`case-studies/${formData.slug}`}
              />
            </div>

            <SEOScorePanel
              content={formData.content}
              title={formData.metaTitle}
              description={formData.metaDescription}
              focusKeyword={formData.focusKeyword}
            />
          </div>
        </div>

        {/* Social SEO */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-4">Social Sharing (OpenGraph &amp; Twitter)</h3>
          <SocialSeoFields
            data={formData}
            onChange={(field, value) => setFormData({ ...formData, [field]: value })}
          />
        </div>

        {/* Schema Builder Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-4">Schema Markup (JSON-LD)</h3>
          <SchemaBuilder
            initialSchema={formData.schemaJson}
            onChange={(schemaJson) => setFormData({ ...formData, schemaJson })}
          />
        </div>
      </div>

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
          disabled={loading}
          className="px-6 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50"
        >
          {loading ? "Saving..." : initialData ? "Update Case Study" : "Create Case Study"}
        </button>
      </div>
    </form>
  );
}
