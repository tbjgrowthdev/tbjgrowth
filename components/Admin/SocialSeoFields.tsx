"use client";

export type SocialSeoData = {
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
};

/**
 * Per-content OpenGraph + Twitter/X fields, shared across Page/Post/CaseStudy/
 * Service admin forms. Every field is optional — the public site falls back
 * to Meta Title/Description, then the content's own image, then the site-wide
 * default OG image in Settings, so leaving these blank is always safe.
 */
export default function SocialSeoFields({
  data,
  onChange,
}: {
  data: SocialSeoData;
  onChange: (field: keyof SocialSeoData, value: string) => void;
}) {
  const inputClass =
    "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-brand-orange";
  const labelClass = "block text-sm font-medium text-muted";

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
          Open Graph (Facebook, LinkedIn...)
        </h4>
        <p className="text-xs text-caption mb-4">
          Optional. Falls back to Meta Title / Meta Description / this content&apos;s own image when left empty.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass}>OG Title</label>
            <input
              type="text"
              value={data.ogTitle}
              onChange={(e) => onChange("ogTitle", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>OG Description</label>
            <textarea
              rows={2}
              value={data.ogDescription}
              onChange={(e) => onChange("ogDescription", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>OG Image URL</label>
            <input
              type="text"
              value={data.ogImage}
              onChange={(e) => onChange("ogImage", e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">Twitter / X</h4>
        <p className="text-xs text-caption mb-4">Optional. Falls back to the Open Graph fields above when left empty.</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={labelClass}>Card Type</label>
            <select
              value={data.twitterCard}
              onChange={(e) => onChange("twitterCard", e.target.value)}
              className={inputClass}
            >
              <option value="">Default (Summary Large Image)</option>
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Twitter Title</label>
            <input
              type="text"
              value={data.twitterTitle}
              onChange={(e) => onChange("twitterTitle", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Twitter Description</label>
            <textarea
              rows={2}
              value={data.twitterDescription}
              onChange={(e) => onChange("twitterDescription", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Twitter Image URL</label>
            <input
              type="text"
              value={data.twitterImage}
              onChange={(e) => onChange("twitterImage", e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
