"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createService, updateService } from "@/app/(admin)/actions/services";
import { replaceServiceFaqs } from "@/app/(admin)/actions/serviceFaqs";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import { slugify } from "@/lib/utils";
import { Save, AlertCircle, Plus, Trash2 } from "lucide-react";

const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

const GRADIENTS = [
  { label: "Blue to Cyan", value: "from-blue-500 to-cyan-500" },
  { label: "Purple to Pink", value: "from-purple-500 to-pink-500" },
  { label: "Orange to Red", value: "from-orange-500 to-red-500" },
  { label: "Green to Emerald", value: "from-green-500 to-emerald-500" },
  { label: "Indigo to Blue", value: "from-indigo-500 to-blue-600" },
  { label: "Violet to Purple", value: "from-violet-500 to-purple-600" },
];

// Older rows stored features as [{icon, text}]; newer ones as plain strings.
function normalizeFeatures(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => (typeof item === "string" ? item : item?.text || "")).filter(Boolean);
  } catch {
    return [];
  }
}

type ProcessStep = { title: string; desc: string };

function normalizeProcess(raw: string | null | undefined): ProcessStep[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({ title: item?.title || "", desc: item?.desc || "" }));
  } catch {
    return [];
  }
}

type FaqItem = { question: string; answer: string };

export default function ServiceForm({ initialData = null }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const originalSlug = initialData?.slug || "";

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    subtitle: initialData?.subtitle || "",
    description: initialData?.description || "",
    detailTitle: initialData?.detailTitle || "",
    detailIntro: initialData?.detailIntro || "",
    content: initialData?.content || "",
    iconName: initialData?.iconName || "Globe",
    statValue: initialData?.statValue || "",
    statLabel: initialData?.statLabel || "",
    gradient: initialData?.gradient || "from-blue-500 to-cyan-500",
    order: initialData?.order || 0,
    metaTitle: initialData?.metaTitle || "",
    metaDescription: initialData?.metaDescription || "",
  });

  const [features, setFeatures] = useState<string[]>(
    initialData?.features ? normalizeFeatures(initialData.features) : [""]
  );
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>(
    initialData?.process ? normalizeProcess(initialData.process) : [{ title: "", desc: "" }]
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(
    initialData?.faqs?.length
      ? initialData.faqs.map((f: any) => ({ question: f.question, answer: f.answer }))
      : [{ question: "", answer: "" }]
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
        features: JSON.stringify(features.map((f) => f.trim()).filter(Boolean)),
        process: JSON.stringify(
          processSteps
            .filter((s) => s.title.trim() || s.desc.trim())
            .map((s, i) => ({ step: i + 1, title: s.title.trim(), desc: s.desc.trim() }))
        ),
      };

      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;

      const result = isExisting
        ? await updateService(initialData.id, dataToSave)
        : await createService(dataToSave);

      if (result.success) {
        const serviceId = result.service?.id ?? initialData?.id;
        const cleanFaqs = faqs
          .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
          .filter((f) => f.question && f.answer);
        if (serviceId) {
          await replaceServiceFaqs(serviceId, cleanFaqs);
        }

        if (slugChanged && confirm(
          `The URL slug changed from "${originalSlug}" to "${formData.slug}".\n\nCreate a 301 redirect from the old URL to the new one so existing links and search rankings aren't broken?`
        )) {
          await createRedirect({
            source: `/services/${originalSlug}`,
            destination: `/services/${formData.slug}`,
            permanent: true,
          });
        }
        router.push("/admin/services");
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground";
  const labelClass = "block text-sm font-medium text-muted mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">Service Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title (H1)</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. Ad Campaigns Managed for Cost-Per-Lead, Not Impressions"
              />
            </div>
            <div>
              <label className={labelClass}>Subtitle</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. Conversion-focused websites"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              URL Slug <span className="text-caption font-normal">(page: /services/{formData.slug || "..."})</span>
            </label>
            <input
              type="text"
              name="slug"
              required
              value={formData.slug}
              onChange={handleChange}
              onBlur={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className={inputClass}
              placeholder="e.g. paid-ads"
            />
          </div>

          <div>
            <label className={labelClass}>
              Description <span className="text-caption font-normal">(shown on the homepage service card)</span>
            </label>
            <textarea
              name="description"
              required
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className={inputClass}
              placeholder="A short summary for the services grid card..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelClass}>Main Icon Name (Lucide)</label>
              <input
                type="text"
                name="iconName"
                required
                value={formData.iconName}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. Globe"
              />
            </div>
            <div>
              <label className={labelClass}>Gradient Theme</label>
              <select name="gradient" value={formData.gradient} onChange={handleChange} className={inputClass}>
                {GRADIENTS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sort Order</label>
              <input type="number" name="order" value={formData.order} onChange={handleChange} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Detail Page Heading &amp; Intro</h2>
        <p className="text-sm text-caption mb-6">
          Optional. Shown as the H1 and intro paragraph on /services/{formData.slug || "..."} instead of
          the card title and description above. Leave empty to reuse those.
        </p>
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className={labelClass}>Detail Page H1</label>
            <input
              type="text"
              name="detailTitle"
              value={formData.detailTitle}
              onChange={handleChange}
              className={inputClass}
              placeholder={formData.title || "e.g. Ad Campaigns Managed for Cost-Per-Lead, Not Impressions"}
            />
          </div>
          <div>
            <label className={labelClass}>Detail Page Intro</label>
            <textarea
              name="detailIntro"
              rows={3}
              value={formData.detailIntro}
              onChange={handleChange}
              className={inputClass}
              placeholder={formData.description || "TBJ Growth Tech plans, builds, and manages..."}
            />
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">SEO</h2>
        <p className="text-sm text-caption mb-6">
          Optional. Falls back to the title and intro above when left empty.
        </p>
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className={labelClass}>Meta Title</label>
            <input
              type="text"
              name="metaTitle"
              value={formData.metaTitle}
              onChange={handleChange}
              className={inputClass}
              placeholder={formData.title ? `${formData.title} | TBJ Growth` : "e.g. Paid Ads Management | TBJ Growth"}
            />
          </div>
          <div>
            <label className={labelClass}>Meta Description</label>
            <textarea
              name="metaDescription"
              rows={2}
              value={formData.metaDescription}
              onChange={handleChange}
              className={inputClass}
              placeholder="A short summary for search results (~150-160 characters)."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Statistic Badge</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Stat Value</label>
              <input
                type="text"
                name="statValue"
                value={formData.statValue}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 98%"
              />
            </div>
            <div>
              <label className={labelClass}>Stat Label</label>
              <input
                type="text"
                name="statLabel"
                value={formData.statLabel}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. PageSpeed Score"
              />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">What&apos;s Included</h2>
            <button
              type="button"
              onClick={() => setFeatures((prev) => [...prev, ""])}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={feature}
                  onChange={(e) =>
                    setFeatures((prev) => prev.map((f, i) => (i === index ? e.target.value : f)))
                  }
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  placeholder="e.g. Meta Ads (Facebook & Instagram)"
                />
                <button
                  type="button"
                  onClick={() => setFeatures((prev) => prev.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 px-1"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">Our Process</h2>
          <button
            type="button"
            onClick={() => setProcessSteps((prev) => [...prev, { title: "", desc: "" }])}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
          >
            <Plus size={16} /> Add Step
          </button>
        </div>
        <p className="text-sm text-caption mb-6">Shown as numbered steps, e.g. Research, Launch, Optimise, Scale.</p>
        <div className="space-y-4">
          {processSteps.map((step, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="w-8 h-9 flex items-center justify-center text-sm font-bold text-caption flex-shrink-0">
                {index + 1}.
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) =>
                    setProcessSteps((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, title: e.target.value } : s))
                    )
                  }
                  className="sm:col-span-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  placeholder="Step title, e.g. Research"
                />
                <input
                  type="text"
                  value={step.desc}
                  onChange={(e) =>
                    setProcessSteps((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, desc: e.target.value } : s))
                    )
                  }
                  className="sm:col-span-2 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  placeholder="Step description"
                />
              </div>
              <button
                type="button"
                onClick={() => setProcessSteps((prev) => prev.filter((_, i) => i !== index))}
                className="text-red-500 hover:text-red-700 px-1 mt-2"
                aria-label="Remove step"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-foreground">FAQ</h2>
          <button
            type="button"
            onClick={() => setFaqs((prev) => [...prev, { question: "", answer: "" }])}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light hover:text-brand-orange"
          >
            <Plus size={16} /> Add Question
          </button>
        </div>
        <p className="text-sm text-caption mb-6">Shown as an accordion on this service&apos;s page.</p>
        <div className="space-y-5">
          {faqs.map((faq, index) => (
            <div key={index} className="p-4 border border-border rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) =>
                    setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))
                  }
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm font-medium"
                  placeholder="Question"
                />
                <button
                  type="button"
                  onClick={() => setFaqs((prev) => prev.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 px-1 py-2"
                  aria-label="Remove question"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <textarea
                value={faq.answer}
                onChange={(e) =>
                  setFaqs((prev) => prev.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))
                }
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                placeholder="Answer"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Additional Long-Form Content</h2>
        <p className="text-sm text-caption mb-6">
          Optional. Shown below the sections above on /services/{formData.slug || "..."}. Leave empty to skip.
        </p>
        <RichTextEditor
          content={formData.content}
          onChange={(content: string) => setFormData((prev) => ({ ...prev, content }))}
        />
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Save Service"}
        </button>
      </div>
    </form>
  );
}
