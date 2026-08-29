"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/app/(admin)/actions/posts";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import dynamic from "next/dynamic";
import { uploadImage } from "@/lib/cloudinary";
import { slugify } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import SERPPreview from "./SERPPreview";
import SEOScorePanel from "./SEOScorePanel";
import SchemaBuilder from "./SchemaBuilder";

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
    schemaJson: initialData?.schemaJson || "",
    status: initialData?.status || "DRAFT",
    publishedAt: initialData?.publishedAt
      ? new Date(initialData.publishedAt).toISOString().slice(0, 16)
      : "",
    isIndexable: initialData?.isIndexable ?? true,
    categoryIds: initialData?.categories?.map((c: any) => c.id) || [],
    tagIds: initialData?.tags?.map((t: any) => t.id) || [],
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadingImage(true);
      setUploadError("");
      try {
        const url = await uploadImage(e.target.files[0]);
        setFormData({ ...formData, featuredImage: url });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Image upload failed");
      } finally {
        setUploadingImage(false);
      }
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
        ? await updatePost(initialData.id, formData)
        : await createPost(formData);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
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
              className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Excerpt</label>
          <textarea
            rows={3}
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Featured Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImage}
            className="w-full px-4 py-2 border border-border rounded-lg bg-transparent disabled:opacity-50"
          />
          {uploadingImage && (
            <div className="mt-2 text-sm text-caption">Uploading...</div>
          )}
          {uploadError && (
            <div className="mt-2 text-sm text-red-600">{uploadError}</div>
          )}
          {formData.featuredImage && !uploadingImage && (
            <div className="mt-2 text-sm text-caption">
              Image uploaded (URL: {formData.featuredImage})
            </div>
          )}
        </div>

        {formData.featuredImage && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Featured Image Alt Text</label>
            <input
              type="text"
              value={formData.featuredImageAlt}
              onChange={(e) => setFormData({ ...formData, featuredImageAlt: e.target.value })}
              placeholder="Describe the image for accessibility & image SEO"
              className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
            >
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {formData.status === "SCHEDULED" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Publish Date & Time</label>
              <input
                type="datetime-local"
                required
                value={formData.publishedAt}
                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              />
            </div>
          )}
        </div>

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
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Meta Description</label>
              <textarea
                rows={3}
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Focus Keyword</label>
              <input
                type="text"
                value={formData.focusKeyword}
                onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Canonical URL</label>
              <input
                type="text"
                value={formData.canonicalUrl}
                onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
                placeholder="https://example.com/canonical-url"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Open Graph Image URL</label>
              <input
                type="text"
                value={formData.ogImage}
                onChange={(e) => setFormData({ ...formData, ogImage: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-muted">Twitter Card Type</label>
              <select
                value={formData.twitterCard}
                onChange={(e) => setFormData({ ...formData, twitterCard: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg bg-transparent focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">Default</option>
                <option value="summary">Summary</option>
                <option value="summary_large_image">Summary Large Image</option>
              </select>
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

        {/* Schema Builder Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-4">Schema Markup (JSON-LD)</h3>
          <SchemaBuilder
            initialSchema={formData.schemaJson}
            onChange={(schemaJson) => setFormData({ ...formData, schemaJson })}
          />
        </div>
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
