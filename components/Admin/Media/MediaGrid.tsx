"use client";

import type { MediaAsset } from "@prisma/client";
import MediaCard from "./MediaCard";

export default function MediaGrid({ assets, onSelect }: { assets: MediaAsset[]; onSelect: (asset: MediaAsset) => void }) {
  if (assets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-caption">
        No media assets found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {assets.map((asset) => (
        <MediaCard key={asset.id} asset={asset} onClick={() => onSelect(asset)} />
      ))}
    </div>
  );
}
