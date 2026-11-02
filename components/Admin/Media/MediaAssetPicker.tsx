"use client";

import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { getMediaAssets } from "@/app/(admin)/actions/media";
import MediaGrid from "./MediaGrid";
import type { MediaAsset } from "@/lib/generated/prisma/client";
import { describeActionError } from "@/lib/admin/action-errors";

interface MediaAssetPickerProps {
  onClose: () => void;
  onSelect: (asset: { url: string; altText: string }) => void;
}

export default function MediaAssetPicker({ onClose, onSelect }: MediaAssetPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        setActionError(null);
        const data = await getMediaAssets({ search, sortBy: "createdAt", sortOrder: "desc" });
        setAssets(data);
      } catch (err) {
        setActionError(describeActionError(err, "Could not load the media library"));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl border border-border max-w-3xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Choose from Library</h2>
          <button type="button" onClick={onClose} className="text-caption hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-caption" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, filename, or alt text..."
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
        </div>

        {actionError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
        {loading ? (
          <p className="text-sm text-caption text-center py-8">Loading...</p>
        ) : (
          <MediaGrid assets={assets} onSelect={(asset) => onSelect({ url: asset.url, altText: asset.altText })} />
        )}
      </div>
    </div>
  );
}
