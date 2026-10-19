"use client";

import SERPPreview from "./SERPPreview";
import SEOScorePanel from "./SEOScorePanel";
import SchemaBuilder from "./SchemaBuilder";
import SocialSeoFields, { type SocialSeoData } from "./SocialSeoFields";
import { validateCanonicalInput } from "@/lib/canonical-validation";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

const CANONICAL_STATUS_STYLE: Record<string, string> = {
  valid: "text-green-600 dark:text-green-400",
  self: "text-caption",
  empty: "text-caption",
  invalid: "text-red-600 dark:text-red-400",
  "cross-domain": "text-amber-600 dark:text-amber-400",
};

export interface SeoPanelData extends SocialSeoData {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  isIndexable: boolean;
  allowFollow: boolean;
  // Google robots meta preview directives — see buildRobotsMeta() in
  // lib/seo-meta.ts. maxSnippet/maxVideoPreview: -1 unlimited, 0 none, or a
  // max character/second count. maxImagePreview: "none" | "standard" | "large".
  maxSnippet: number;
  maxImagePreview: string;
  maxVideoPreview: number;
  schemaJson: string;
}

/**
 * The one shared "SEO Settings" block — Meta Title/Description, Focus
 * Keyword, Secondary Keywords, Canonical, Robots (index + follow), a live
 * SERP preview, the SEO score panel, Social Sharing fields, and the
 * Schema builder. Used identically by Page/Post/CaseStudy/Service forms
 * instead of each duplicating this JSX (they previously did, independently,
 * with Service missing several of these fields entirely) — the "native
 * integrated architecture" the Unified SEO Engine asked for, built by
 * composing the sub-panels (SERPPreview/SEOScorePanel/SchemaBuilder/
 * SocialSeoFields) that already existed as shared components, rather than
 * introducing a parallel set.
 *
 * `onChange` takes one field at a time, same shape as SocialSeoFields'
 * own `onChange`, so a parent form's existing `setFormData({...formData,
 * [field]: value})` pattern works unchanged — no restructuring of any
 * form's state shape was needed to adopt this.
 */
export default function SeoPanel({
  data,
  onChange,
  secondaryKeywords,
  onSecondaryKeywordsChange,
  content,
  slugPreviewPath,
  contentLabel,
  autoSchema,
}: {
  data: SeoPanelData;
  onChange: (field: keyof SeoPanelData, value: string | boolean | number) => void;
  secondaryKeywords: string[];
  onSecondaryKeywordsChange: (keywords: string[]) => void;
  content: string;
  slugPreviewPath: string;
  contentLabel: string;
  // What the Full Schema Engine would auto-generate for this content right
  // now — see SchemaBuilder's autoSchema prop. Omit/null for content types
  // the engine doesn't auto-generate schema for (e.g. generic Pages).
  autoSchema?: object | null;
}) {
  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange";
  const labelClass = "block text-sm font-medium text-muted";

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border space-y-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">SEO Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass}>Meta Title (SEO Title)</label>
            <input type="text" value={data.metaTitle} onChange={(e) => onChange("metaTitle", e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Meta Description</label>
            <textarea rows={3} value={data.metaDescription} onChange={(e) => onChange("metaDescription", e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Focus Keyword</label>
            <input type="text" value={data.focusKeyword} onChange={(e) => onChange("focusKeyword", e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Secondary Keywords</label>
            <input
              type="text"
              value={secondaryKeywords.join(", ")}
              onChange={(e) => onSecondaryKeywordsChange(e.target.value.split(",").map((k) => k.trim()).filter(Boolean))}
              placeholder="comma-separated, e.g. technical seo, site audit tool"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Canonical URL</label>
            <input
              type="text"
              value={data.canonicalUrl}
              onChange={(e) => onChange("canonicalUrl", e.target.value)}
              className={inputClass}
              placeholder="https://example.com/canonical-url"
            />
            {(() => {
              const selfUrl = `${baseUrl}/${slugPreviewPath}`;
              const check = validateCanonicalInput(data.canonicalUrl, selfUrl);
              return <p className={`text-xs ${CANONICAL_STATUS_STYLE[check.status]}`}>{check.message}</p>;
            })()}
          </div>

          <div className="space-y-2 pt-2">
            <label className={labelClass}>Robots</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isIndexable"
                checked={data.isIndexable}
                onChange={(e) => onChange("isIndexable", e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="isIndexable" className="text-sm text-muted">
                Allow search engines to index this {contentLabel} (unchecking sets meta robots to noindex)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowFollow"
                checked={data.allowFollow}
                onChange={(e) => onChange("allowFollow", e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="allowFollow" className="text-sm text-muted">
                Allow search engines to follow links on this {contentLabel} (unchecking sets meta robots to nofollow)
              </label>
            </div>

            {data.isIndexable && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="block text-xs text-caption">Max Snippet</label>
                  <input
                    type="number"
                    value={data.maxSnippet}
                    onChange={(e) => onChange("maxSnippet", parseInt(e.target.value, 10) || 0)}
                    className={inputClass}
                  />
                  <p className="text-xs text-caption">-1 unlimited, 0 none, or max characters</p>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-caption">Max Image Preview</label>
                  <select
                    value={data.maxImagePreview}
                    onChange={(e) => onChange("maxImagePreview", e.target.value)}
                    className={inputClass}
                  >
                    <option value="none">None</option>
                    <option value="standard">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-caption">Max Video Preview</label>
                  <input
                    type="number"
                    value={data.maxVideoPreview}
                    onChange={(e) => onChange("maxVideoPreview", parseInt(e.target.value, 10) || 0)}
                    className={inputClass}
                  />
                  <p className="text-xs text-caption">-1 unlimited, 0 none, or max seconds</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className={labelClass}>Live SERP Preview</label>
            <SERPPreview title={data.metaTitle} description={data.metaDescription} slug={slugPreviewPath} />
          </div>

          <SEOScorePanel content={content} title={data.metaTitle} description={data.metaDescription} focusKeyword={data.focusKeyword} />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-lg font-medium text-foreground mb-4">Social Sharing (OpenGraph &amp; Twitter)</h3>
        <SocialSeoFields data={data} onChange={onChange} />
      </div>

      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-lg font-medium text-foreground mb-4">Schema Markup (JSON-LD)</h3>
        <SchemaBuilder initialSchema={data.schemaJson} onChange={(schemaJson) => onChange("schemaJson", schemaJson)} autoSchema={autoSchema} />
      </div>
    </div>
  );
}
