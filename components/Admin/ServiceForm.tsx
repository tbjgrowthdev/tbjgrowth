"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createService, updateService } from "@/app/(admin)/actions/services";
import { createRedirect } from "@/app/(admin)/actions/redirects";
import { slugify } from "@/lib/utils";
import { Save, AlertCircle } from "lucide-react";

const RichTextEditor = dynamic(() => import("./Editor"), { ssr: false });

const GRADIENTS = [
  { label: "Blue to Cyan", value: "from-blue-500 to-cyan-500" },
  { label: "Purple to Pink", value: "from-purple-500 to-pink-500" },
  { label: "Orange to Red", value: "from-orange-500 to-red-500" },
  { label: "Green to Emerald", value: "from-green-500 to-emerald-500" },
  { label: "Indigo to Blue", value: "from-indigo-500 to-blue-600" },
  { label: "Violet to Purple", value: "from-violet-500 to-purple-600" },
];

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
    content: initialData?.content || "",
    iconName: initialData?.iconName || "Globe",
    statValue: initialData?.statValue || "",
    statLabel: initialData?.statLabel || "",
    gradient: initialData?.gradient || "from-blue-500 to-cyan-500",
    order: initialData?.order || 0,
    features: initialData?.features ? JSON.parse(initialData.features) : [
      { icon: "Monitor", text: "" },
      { icon: "Palette", text: "" },
      { icon: "Code2", text: "" },
      { icon: "Zap", text: "" }
    ],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFeatureChange = (index: number, field: string, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    setFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        order: Number(formData.order),
        features: JSON.stringify(formData.features),
      };

      const isExisting = Boolean(initialData?.id);
      const slugChanged = isExisting && originalSlug && formData.slug !== originalSlug;

      const result = isExisting
        ? await updateService(initialData.id, dataToSave)
        : await createService(dataToSave);

      if (result.success) {
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
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
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

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-6">Service Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Title</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Web Design & Development"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Subtitle</label>
              <input
                type="text"
                name="subtitle"
                value={formData.subtitle}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Conversion-focused websites"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">
              URL Slug <span className="text-caption font-normal">(page: /services/{formData.slug || "..."})</span>
            </label>
            <input
              type="text"
              name="slug"
              required
              value={formData.slug}
              onChange={handleChange}
              onBlur={(e) => setFormData((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              placeholder="e.g. web-design-development"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Description</label>
            <textarea
              name="description"
              required
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              placeholder="Detailed description..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Main Icon Name (Lucide)</label>
              <input
                type="text"
                name="iconName"
                required
                value={formData.iconName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Globe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Gradient Theme</label>
              <select
                name="gradient"
                value={formData.gradient}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              >
                {GRADIENTS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Sort Order</label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Statistic Badge</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Stat Value</label>
              <input
                type="text"
                name="statValue"
                value={formData.statValue}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. 98%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Stat Label</label>
              <input
                type="text"
                name="statLabel"
                value={formData.statLabel}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. PageSpeed Score"
              />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Features (4 Items)</h2>
          <div className="space-y-4">
            {formData.features.map((feature: any, index: number) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={feature.icon}
                  onChange={(e) => handleFeatureChange(index, "icon", e.target.value)}
                  className="w-1/3 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  placeholder="Icon (e.g. Monitor)"
                />
                <input
                  type="text"
                  value={feature.text}
                  onChange={(e) => handleFeatureChange(index, "text", e.target.value)}
                  className="w-2/3 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  placeholder="Feature Text"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
        <h2 className="text-xl font-bold text-foreground mb-2">Detail Page Content</h2>
        <p className="text-sm text-caption mb-6">
          Optional. Shown on this service&apos;s own page at /services/{formData.slug || "..."}, below the summary. Leave empty to show just the description and features above.
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
