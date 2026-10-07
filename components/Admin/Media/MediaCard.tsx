"use client";

import Image from "next/image";
import { cloudinaryUrl } from "@/lib/cloudinary-url";
import type { MediaAsset } from "@prisma/client";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaCard({ asset, onClick }: { asset: MediaAsset; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-card border border-border rounded-lg overflow-hidden hover:ring-2 hover:ring-brand-orange transition-all"
    >
      <div className="relative w-full aspect-square bg-background">
        <Image
          src={cloudinaryUrl(asset.url, { width: 400 })}
          alt={asset.altText}
          fill
          className="object-cover"
          sizes="200px"
        />
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
        <p className="text-xs text-caption truncate">
          {asset.width}×{asset.height} · {formatBytes(asset.bytes)}
        </p>
        <p className="text-xs text-caption truncate">{asset.folder}</p>
      </div>
    </button>
  );
}
