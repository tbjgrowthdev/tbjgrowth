"use client";

import { useState } from "react";
import { X, Upload } from "lucide-react";
import { uploadMediaAsset } from "@/app/(admin)/actions/media";
import type { MediaAsset } from "@prisma/client";

interface MediaUploadModalProps {
  folders: string[];
  onClose: () => void;
  onUploaded: (asset: MediaAsset) => void;
}

export default function MediaUploadModal({ folders, onClose, onUploaded }: MediaUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file || !altText.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadMediaAsset(file, {
        altText,
        title: title || undefined,
        folder: newFolder.trim() || folder || undefined,
      });
      if (result.success && result.asset) {
        onUploaded(result.asset);
        onClose();
      } else {
        setError(result.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  };

  const canUpload = Boolean(file && altText.trim() && !uploading);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl border border-border max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Upload Image</h2>
          <button type="button" onClick={onClose} className="text-caption hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">File</label>
          <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm" />
          {previewUrl && (
            <div className="relative w-full h-40 bg-background rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">
            Alt Text <span className="text-red-500">(required)</span>
          </label>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="Describe the image for accessibility and SEO"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Defaults to the filename"
            className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Folder</label>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            >
              <option value="">Uncategorized</option>
              {folders.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-muted">Or new folder</label>
            <input
              type="text"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="e.g. Blog"
              className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg hover:bg-background">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canUpload}
            onClick={handleUpload}
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
