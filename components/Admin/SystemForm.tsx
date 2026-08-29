"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSystem, updateSystem } from "@/app/(admin)/actions/systems";
import { Save, AlertCircle } from "lucide-react";

const GRADIENTS = [
  { label: "Blue to Cyan", value: "from-blue-500 to-cyan-500" },
  { label: "Purple to Pink", value: "from-purple-500 to-pink-500" },
  { label: "Orange to Red", value: "from-orange-500 to-red-500" },
  { label: "Green to Emerald", value: "from-green-500 to-emerald-500" },
  { label: "Indigo to Blue", value: "from-indigo-500 to-blue-600" },
  { label: "Violet to Purple", value: "from-violet-500 to-purple-600" },
];

export default function SystemForm({ initialData = null }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    subtitle: initialData?.subtitle || "",
    description: initialData?.description || "",
    iconName: initialData?.iconName || "BrainCircuit",
    previewIcon: initialData?.previewIcon || "LineChart",
    status: initialData?.status || "Coming Soon",
    progress: initialData?.progress || 0,
    tagline: initialData?.tagline || "",
    gradient: initialData?.gradient || "from-blue-500 to-cyan-500",
    quarterly: initialData?.quarterly || "",
    availability: initialData?.availability || "",
    shapeName: initialData?.shapeName || "Circle",
    order: initialData?.order || 0,
    features: initialData?.features ? JSON.parse(initialData.features) : [
      "", "", "", "", ""
    ],
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData((prev) => ({ ...prev, features: newFeatures }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        progress: Number(formData.progress),
        order: Number(formData.order),
        features: JSON.stringify(formData.features),
      };

      const result = initialData
        ? await updateSystem(initialData.id, dataToSave)
        : await createSystem(dataToSave);

      if (result.success) {
        router.push("/admin/systems");
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
        <h2 className="text-xl font-bold text-foreground mb-6">TBJ System Details</h2>
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
                placeholder="e.g. TBJ Intelligence"
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
                placeholder="e.g. AI-Powered Analytics Suite"
              />
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Tagline</label>
              <input
                type="text"
                name="tagline"
                value={formData.tagline}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Know before they do"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Main Icon Name</label>
              <input
                type="text"
                name="iconName"
                required
                value={formData.iconName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. BrainCircuit"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Preview Icon Name</label>
              <input
                type="text"
                name="previewIcon"
                value={formData.previewIcon}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. LineChart"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Shape Name (Lucide)</label>
              <input
                type="text"
                name="shapeName"
                value={formData.shapeName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Circle"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Expected Release (Quarterly)</label>
              <input
                type="text"
                name="quarterly"
                value={formData.quarterly}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Q4 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Availability Status</label>
              <input
                type="text"
                name="availability"
                value={formData.availability}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Closed Beta"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Status & Progress</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Status Text</label>
              <input
                type="text"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                placeholder="e.g. Beta Q4 2026"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Progress (%)</label>
              <input
                type="number"
                name="progress"
                min="0" max="100"
                value={formData.progress}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
          <h2 className="text-xl font-bold text-foreground mb-6">Features (List)</h2>
          <div className="space-y-4">
            {formData.features.map((feature: string, index: number) => (
              <input
                key={index}
                type="text"
                value={feature}
                onChange={(e) => handleFeatureChange(index, e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                placeholder={`Feature ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Save System"}
        </button>
      </div>
    </form>
  );
}
