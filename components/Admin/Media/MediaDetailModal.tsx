"use client";

import { useState } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import Image from "next/image";
import { cloudinaryUrl } from "@/lib/cloudinary-url";
import { updateMediaMetadata, replaceMediaAsset } from "@/app/(admin)/actions/media";
import MediaDeleteButton from "./MediaDeleteButton";
import type { MediaAsset } from "@prisma/client";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MediaDetailModalProps {
  asset: MediaAsset;
  onClose: () => void;
  onUpdated: (asset: MediaAsset) => void;
  onDeleted: () => void;
  selectMode?: boolean;
  onSelect?: (asset: MediaAsset) => void;
}

export default function MediaDetailModal({ asset, onClose, onUpdated, onDeleted, selectMode, onSelect }: MediaDetailModalProps) {
  const [title, setTitle] = useState(asset.title);
  const [altText, setAltText] = useState(asset.altText);
  const [folder, setFolder] = useState(asset.folder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateMediaMetadata(asset.id, { title, altText, folder });
      if (result.success && result.asset) {
        onUpdated(result.asset);
      } else {
        setError(result.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async () => {
    if (!replaceFile) return;
    const confirmed = confirm(
      "Replacing this asset gives it a new URL. Any content that already copied the old URL will keep showing the old image.\n\nContinue?"
    );
    if (!confirmed) return;

    setReplacing(true);
    setError(null);
    try {
      const result = await replaceMediaAsset(asset.id, replaceFile, altText);
      if (result.success && result.asset) {
        onUpdated(result.asset);
        setReplaceFile(null);
      } else {
        setError(result.error || "Failed to replace");
      }
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl border border-border max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Asset Details</h2>
          <button type="button" onClick={onClose} className="text-caption hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        <div className="relative w-full h-64 bg-background rounded-lg overflow-hidden">
          <Image src={cloudinaryUrl(asset.url, { width: 800 })} alt={asset.altText} fill className="object-contain" sizes="600px" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm text-caption">
          <p>Dimensions: {asset.width}×{asset.height}</p>
          <p>Size: {formatBytes(asset.bytes)}</p>
          <p>Format: {asset.format}</p>
          <p>Uploaded by: {asset.uploadedByName || asset.uploadedByEmail || "Unknown"}</p>
          <p>Created: {new Date(asset.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(asset.updatedAt).toLocaleString()}</p>
          <p className="col-span-2 truncate">Public ID: {asset.publicId}</p>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">
              Alt Text <span className="text-red-500">(required)</span>
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-muted">Folder</label>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <button
            type="button"
            disabled={saving || !altText.trim()}
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange disabled:opacity-50 text-sm"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <label className="block text-sm font-medium text-muted">Replace Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
          <button
            type="button"
            disabled={!replaceFile || replacing}
            onClick={handleReplace}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background disabled:opacity-50 text-sm"
          >
            <RefreshCw size={16} />
            {replacing ? "Replacing..." : "Replace"}
          </button>
        </div>

        <div className="flex justify-between items-center border-t border-border pt-4">
          <MediaDeleteButton id={asset.id} onDeleted={onDeleted} />
          {selectMode && onSelect && (
            <button
              type="button"
              onClick={() => onSelect(asset)}
              className="px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange text-sm font-medium"
            >
              Use This Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
