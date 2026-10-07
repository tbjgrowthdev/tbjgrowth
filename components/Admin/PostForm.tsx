"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost, transitionPost } from "@/app/(admin)/actions/posts";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import dynamic from "next/dynamic";
import { uploadMediaAsset } from "@/app/(admin)/actions/media";
import { slugify } from "@/lib/utils";
import { AlertCircle, Upload, FolderOpen } from "lucide-react";
import MediaAssetPicker from "./Media/MediaAssetPicker";
import SERPPreview from "./SERPPreview";
import SEOScorePanel from "./SEOScorePanel";
import SchemaBuilder from "./SchemaBuilder";
import SocialSeoFields from "./SocialSeoFields";
import WorkflowPanel from "./WorkflowPanel";
import AssignmentPanel from "./AssignmentPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";

// Dynamically import TipTap so it doesn't cause SSR issues
const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

type Taxonomy = { id: string; name: string };

export default function PostForm({
  initialData,
  categories = [],
  tags = [],
}: {
  initialData?: any;
  categories?: Taxonomy[];
  tags?: Taxonomy[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const originalSlug = initialData?.slug || "";
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    content: initialData?.content || "",
    excerpt: initialData?.excerpt || "",
    featuredImage: initialData?.featuredImage || "",
    featuredImageAlt: initialData?.featuredImageAlt || "",
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
    categoryIds: initialData?.categories?.map((c: any) => c.id) || [],
    tagIds: initialData?.tags?.map((t: any) => t.id) || [],
  });
  // Decoupled from formData — status only ever changes via WorkflowPanel's
  // transition actions, never through the general content save below.
  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  // A per-save note, not persisted content — cleared after each successful
  // save since it describes THAT save, not a standing field.
  const [changeSummary, setChangeSummary] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingAltText, setPendingAltText] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);

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
      const result = await uploadMediaAsset(pendingFile, { altText: pendingAltText, folder: "Blog" });
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

  const toggleId = (field: "categoryIds" | "tagIds", id: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((existing: string) => existing !== id)
        : [...prev[field], id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;

      const result = isExisting
        ? await updatePost(initialData.id, { ...formData, changeSummary })
        : await createPost({ ...formData, changeSummary });

      if (result.success) {
        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await createRedirect({
            source: `/blog/${originalSlug}`,
            destination: `/blog/${formData.slug}`,
            permanent: true,
          });
        }
        router.push("/admin/posts");
        router.refresh();
      } else {
        setError(result.error || "Failed to save post");
      }
    } catch (err) {
      console.error("Failed to save post", err);
      setError(err instanceof Error ? err.message : "Failed to save post");
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
        {!initialData?.id && (
          <p className="text-sm text-caption bg-background border border-border rounded-lg px-4 py-2">
            New posts are always created as a <strong>Draft</strong>. Submit it for review and publish from the workflow panel after saving.
          </p>
        )}

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

        {categories.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleId("categoryIds", cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.categoryIds.includes(cat.id)
                      ? "bg-brand-orange-deep text-white"
                      : "bg-background text-muted hover:bg-tint"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Tags</label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleId("tagIds", tag.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    formData.tagIds.includes(tag.id)
                      ? "bg-brand-orange-deep text-white"
                      : "bg-background text-muted hover:bg-tint"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
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
            Allow search engines to index this post (unchecking sets meta robots to noindex)
          </label>
        </div>
      </div>

      {initialData?.id && (
        <>
          <WorkflowPanel
            contentType="POST"
            contentId={initialData.id}
            status={status}
            onTransition={transitionPost}
            onStatusChange={setStatus}
          />
          <AssignmentPanel
            contentType="POST"
            contentId={initialData.id}
            authorId={initialData.authorId}
            reviewerId={initialData.reviewerId}
            seoReviewerId={initialData.seoReviewerId}
            approverId={initialData.approverId}
            reviewDeadline={initialData.reviewDeadline}
          />
          <VersionHistoryPanel contentType="POST" contentId={initialData.id} />
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
                slug={`blog/${formData.slug}`}
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
          placeholder="What changed in this save? e.g. 'Fixed typo in intro, updated CTA'"
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
          {loading ? "Saving..." : initialData ? "Update Post" : "Create Post"}
        </button>
      </div>
    </form>
  );
}
