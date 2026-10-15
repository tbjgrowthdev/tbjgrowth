"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPartner, updatePartner } from "@/app/(admin)/actions/partners";
import { uploadMediaAsset } from "@/app/(admin)/actions/media";
import { Save, AlertCircle, Upload, FolderOpen } from "lucide-react";
import MediaAssetPicker from "./Media/MediaAssetPicker";

export default function PartnerForm({ initialData = null }: { initialData?: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    logoUrl: initialData?.logoUrl || "",
    order: initialData?.order || 0,
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [pendingAltText, setPendingAltText] = useState("");
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
    setPendingAltText(formData.name ? `${formData.name} logo` : "");
    setUploadError("");
  };

  const handleCancelPending = () => {
    setPendingFile(null);
    setPendingPreviewUrl(null);
    setPendingAltText("");
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile || !pendingAltText.trim()) return;
    setUploadingLogo(true);
    setUploadError("");
    try {
      const result = await uploadMediaAsset(pendingFile, { altText: pendingAltText, folder: "Partners" });
      if (result.success && result.url) {
        setFormData((prev) => ({ ...prev, logoUrl: result.url }));
        handleCancelPending();
      } else {
        setUploadError(result.error || "Logo upload failed");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const dataToSave = {
        ...formData,
        order: Number(formData.order),
      };

      const result = initialData
        ? await updatePartner(initialData.id, dataToSave)
        : await createPartner(dataToSave);

      if (result.success) {
        router.push("/admin/partners");
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
        <h2 className="text-xl font-bold text-foreground mb-6">Partner Details</h2>
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Company Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted mb-1">Logo URL (Optional)</label>
            <input
              type="text"
              name="logoUrl"
              value={formData.logoUrl}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              placeholder="https://example.com/logo.png"
            />

            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                disabled={uploadingLogo}
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

            {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}

            {pendingPreviewUrl && (
              <div className="space-y-2 p-4 border border-border rounded-lg bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingPreviewUrl} alt="Preview" className="h-24 object-contain" />
                <label className="block text-sm font-medium text-muted">
                  Alt Text <span className="text-red-500">(required to upload)</span>
                </label>
                <input
                  type="text"
                  value={pendingAltText}
                  onChange={(e) => setPendingAltText(e.target.value)}
                  placeholder="Describe the logo for accessibility & image SEO"
                  className="w-full px-4 py-2 border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-brand-orange"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo || !pendingAltText.trim()}
                    onClick={handleConfirmUpload}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
                  >
                    <Upload size={16} />
                    {uploadingLogo ? "Uploading..." : "Upload logo"}
                  </button>
                  <button type="button" onClick={handleCancelPending} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-tint">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {formData.logoUrl && !pendingPreviewUrl && (
              <div className="flex items-center gap-3 text-sm text-caption">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formData.logoUrl} alt="Current logo" className="h-10 object-contain border border-border rounded-md bg-background p-1" />
                <span className="truncate">{formData.logoUrl}</span>
              </div>
            )}

            {showMediaPicker && (
              <MediaAssetPicker
                onClose={() => setShowMediaPicker(false)}
                onSelect={({ url }) => {
                  setFormData((prev) => ({ ...prev, logoUrl: url }));
                  setShowMediaPicker(false);
                }}
              />
            )}
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

      <div className="flex justify-end pt-6 border-t border-border">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-50"
        >
          <Save size={20} />
          {isSubmitting ? "Saving..." : "Save Partner"}
        </button>
      </div>
    </form>
  );
}
