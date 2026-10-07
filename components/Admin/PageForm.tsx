"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPage, updatePage, transitionPage } from "@/app/(admin)/actions/pages";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import dynamic from "next/dynamic";
import { slugify } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import SERPPreview from "./SERPPreview";
import SEOScorePanel from "./SEOScorePanel";
import SchemaBuilder from "./SchemaBuilder";
import SocialSeoFields from "./SocialSeoFields";
import WorkflowPanel from "./WorkflowPanel";
import AssignmentPanel from "./AssignmentPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";

// Dynamically import TipTap so it doesn't cause SSR issues
const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

export default function PageForm({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalSlug = initialData?.slug || "";
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    content: initialData?.content || "",
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
  });
  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [changeSummary, setChangeSummary] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;

      const result = isExisting
        ? await updatePage(initialData.id, { ...formData, changeSummary })
        : await createPage({ ...formData, changeSummary });

      if (result.success) {
        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await createRedirect({
            source: `/${originalSlug}`,
            destination: `/${formData.slug}`,
            permanent: true,
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

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isIndexable"
            checked={formData.isIndexable}
            onChange={(e) => setFormData({ ...formData, isIndexable: e.target.checked })}
            className="w-4 h-4 rounded border-border"
          />
          <label htmlFor="isIndexable" className="text-sm text-muted">
            Allow search engines to index this page (unchecking sets meta robots to noindex)
          </label>
        </div>
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
                slug={formData.slug} 
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
          {loading ? "Saving..." : initialData ? "Update Page" : "Create Page"}
        </button>
      </div>
    </form>
  );
}
