"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLocation, updateLocation } from "@/app/(admin)/actions/locations";
import { replaceLocationFaqs } from "@/app/(admin)/actions/locationFaqs";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import { slugify } from "@/lib/utils";
import { Save, AlertCircle, Plus, Trash2 } from "lucide-react";
import SeoPanel from "./SeoPanel";
import { parseSecondaryKeywords } from "@/lib/seo-fields";
import { parseServiceAreas } from "@/lib/locations";
import ContentLockBanner from "./ContentLockBanner";

// Mirrors lib/i18n.ts's Market union — kept as a plain string on the model
// (not a DB enum), so this list is the single source of truth for valid values.
const MARKETS = [
  { value: "uk", label: "UK" },
  { value: "bangladesh", label: "Bangladesh" },
  { value: "gulf", label: "Gulf (UAE)" },
];

type FaqItem = { question: string; answer: string };

type LocationFormInitialData = Partial<{
  id: string;
  updatedAt: Date | string;
  name: string;
  slug: string;
  market: string;
  intro: string | null;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string | null;
  postalCode: string | null;
  addressCountry: string;
  phone: string;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  order: number;
  isIndexable: boolean;
  allowFollow: boolean;
  maxSnippet: number;
  maxImagePreview: string;
  maxVideoPreview: number;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  secondaryKeywords: string | null;
  canonicalUrl: string | null;
  schemaJson: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImage: string | null;
  serviceAreas: string | null;
  faqs: FaqItem[];
}>;

export default function LocationForm({ initialData = null }: { initialData?: LocationFormInitialData | null }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedByOther, setLockedByOther] = useState(false);
  const originalSlug = initialData?.slug || "";

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    market: initialData?.market || "uk",
    intro: initialData?.intro || "",
    streetAddress: initialData?.streetAddress || "",
    addressLocality: initialData?.addressLocality || "",
    addressRegion: initialData?.addressRegion || "",
    postalCode: initialData?.postalCode || "",
    addressCountry: initialData?.addressCountry || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    latitude: initialData?.latitude ?? "",
    longitude: initialData?.longitude ?? "",
    order: initialData?.order || 0,
    isIndexable: initialData?.isIndexable ?? true,
    allowFollow: initialData?.allowFollow ?? true,
    maxSnippet: initialData?.maxSnippet ?? -1,
    maxImagePreview: initialData?.maxImagePreview || "large",
    maxVideoPreview: initialData?.maxVideoPreview ?? -1,
    metaTitle: initialData?.metaTitle || "",
    metaDescription: initialData?.metaDescription || "",
    focusKeyword: initialData?.focusKeyword || "",
    secondaryKeywords: parseSecondaryKeywords(initialData?.secondaryKeywords),
    canonicalUrl: initialData?.canonicalUrl || "",
    schemaJson: initialData?.schemaJson || "",
    ogTitle: initialData?.ogTitle || "",
    ogDescription: initialData?.ogDescription || "",
    ogImage: initialData?.ogImage || "",
    twitterCard: initialData?.twitterCard || "",
    twitterTitle: initialData?.twitterTitle || "",
    twitterDescription: initialData?.twitterDescription || "",
    twitterImage: initialData?.twitterImage || "",
  });

  const [serviceAreas, setServiceAreas] = useState<string[]>(
    initialData?.serviceAreas ? parseServiceAreas(initialData.serviceAreas) : [""]
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(
    initialData?.faqs?.length ? initialData.faqs.map((f) => ({ question: f.question, answer: f.answer })) : [{ question: "", answer: "" }]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        order: Number(formData.order),
        latitude: formData.latitude === "" ? null : Number(formData.latitude),
        longitude: formData.longitude === "" ? null : Number(formData.longitude),
        serviceAreas: JSON.stringify(serviceAreas.map((a) => a.trim()).filter(Boolean)),
        secondaryKeywords: JSON.stringify(formData.secondaryKeywords),
        expectedUpdatedAt: initialData?.updatedAt,
      };

      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;

      const result = isExisting ? await updateLocation(initialData!.id!, dataToSave) : await createLocation(dataToSave);

      if (result.success) {
        const locationId = result.location?.id ?? initialData?.id;
        const cleanFaqs = faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question && f.answer);
        if (locationId) {
          await replaceLocationFaqs(locationId, cleanFaqs);
        }

        if (
          slugChanged &&
          confirm(
            `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
          )
        ) {
          await createRedirect({ source: `/locations/${originalSlug}`, destination: `/locations/${formData.slug}`, statusCode: 301 });
        }
        router.push("/admin/locations");
      } else {
        setError(result.error ?? "Something went wrong");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";
  const labelClass = "block text-sm font-medium text-muted mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {initialData?.id && <ContentLockBanner contentType="LOCATION" contentId={initialData.id} onLockStateChange={setLockedByOther} />}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">Location Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Business Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. TBJ Growth Tech — Dhaka"
              />
            </div>
            <div>
              <label className={labelClass}>Market</label>
              <select name="market" value={formData.market} onChange={handleChange} className={inputClass}>
                {MARKETS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              URL Slug <span className="text-caption font-normal">(page: /locations/{formData.slug || "..."})</span>
            </label>
            <input
              type="text"
              name="slug"
              required
              value={formData.slug}
              onChange={handleChange}
              onBlur={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className={inputClass}
              placeholder="e.g. dhaka"
            />
          </div>

          <div>
            <label className={labelClass}>
              Intro <span className="text-caption font-normal">(shown at the top of the location page)</span>
            </label>
            <textarea name="intro" rows={3} value={formData.intro} onChange={handleChange} className={inputClass} placeholder="A short intro for this location..." />
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Name, Address &amp; Phone (NAP)</h2>
        <p className="text-sm text-caption mb-6">
          Used verbatim for the page&apos;s LocalBusiness schema and on-page address block — must match what&apos;s listed on this location&apos;s Google Business
          Profile and other citations for consistent local SEO.
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Street Address</label>
            <input type="text" name="streetAddress" required value={formData.streetAddress} onChange={handleChange} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>City</label>
              <input type="text" name="addressLocality" required value={formData.addressLocality} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Region / State</label>
              <input type="text" name="addressRegion" value={formData.addressRegion} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Postal Code</label>
              <input type="text" name="postalCode" value={formData.postalCode} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Country Code</label>
              <input type="text" name="addressCountry" required value={formData.addressCountry} onChange={handleChange} className={inputClass} placeholder="e.g. GB" maxLength={2} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone</label>
              <input type="text" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Latitude <span className="text-caption font-normal">(optional — for map/geo schema)</span>
              </label>
              <input type="number" step="any" name="latitude" value={formData.latitude} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input type="number" step="any" name="longitude" value={formData.longitude} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">Service Areas</h2>
          <button
            type="button"
            onClick={() => setServiceAreas((prev) => [...prev, ""])}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
          >
            <Plus size={16} /> Add Area
          </button>
        </div>
        <p className="text-sm text-caption mb-6">Cities/areas served from this location — shown on the page and used as the LocalBusiness schema&apos;s areaServed.</p>
        <div className="space-y-3">
          {serviceAreas.map((area, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={area}
                onChange={(e) => setServiceAreas((prev) => prev.map((a, i) => (i === index ? e.target.value : a)))}
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                placeholder="e.g. Gulshan"
              />
              <button type="button" onClick={() => setServiceAreas((prev) => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 px-1" aria-label="Remove area">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">Local FAQ</h2>
          <button
            type="button"
            onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
          >
            <Plus size={16} /> Add Question
          </button>
        </div>
        <p className="text-sm text-caption mb-6">Shown as an accordion on this location&apos;s page.</p>
        <div className="space-y-5">
          {faqs.map((faq, index) => (
            <div key={index} className="p-4 border border-border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-medium"
                  placeholder="Question"
                />
                <button type="button" onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 px-1 py-2" aria-label="Remove question">
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea
                value={faq.answer}
                onChange={(e) => setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))}
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                placeholder="Answer"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-caption">SEO fields below are optional — they fall back to the business name and intro above when left empty.</p>
      <SeoPanel
        data={formData}
        onChange={(field, value) => setFormData({ ...formData, [field]: value })}
        secondaryKeywords={formData.secondaryKeywords}
        onSecondaryKeywordsChange={(secondaryKeywords) => setFormData({ ...formData, secondaryKeywords })}
        content={formData.intro}
        slugPreviewPath={`locations/${formData.slug}`}
        contentLabel="location"
      />

      <div className="flex items-center gap-3 bg-card p-6 rounded-xl shadow-sm border border-border">
        <label className={labelClass}>Sort Order</label>
        <input type="number" name="order" value={formData.order} onChange={handleChange} className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-foreground" />
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting || lockedByOther}
          title={lockedByOther ? "Someone else is currently editing this — take over editing to save" : undefined}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Save Location"}
        </button>
      </div>
    </form>
  );
}
