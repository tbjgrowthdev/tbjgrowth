"use client";

import { useEffect, useMemo, useState } from "react";
import { getMediaAssets } from "@/app/(admin)/actions/media";
import MediaToolbar, { type SortOption } from "./MediaToolbar";
import MediaGrid from "./MediaGrid";
import MediaUploadModal from "./MediaUploadModal";
import MediaDetailModal from "./MediaDetailModal";
import type { MediaAsset } from "@prisma/client";

const SORT_MAP: Record<SortOption, { sortBy: "createdAt" | "title" | "bytes"; sortOrder: "asc" | "desc" }> = {
  newest: { sortBy: "createdAt", sortOrder: "desc" },
  oldest: { sortBy: "createdAt", sortOrder: "asc" },
  name: { sortBy: "title", sortOrder: "asc" },
  largest: { sortBy: "bytes", sortOrder: "desc" },
  smallest: { sortBy: "bytes", sortOrder: "asc" },
};

export default function MediaLibraryClient({ initialAssets, initialFolders }: { initialAssets: MediaAsset[]; initialFolders: string[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [folders, setFolders] = useState(initialFolders);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [showUpload, setShowUpload] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);

  const refresh = async () => {
    const { sortBy, sortOrder } = SORT_MAP[sort];
    const data = await getMediaAssets({ search, folder, sortBy, sortOrder });
    setAssets(data);
  };

  useEffect(() => {
    const timeout = setTimeout(refresh, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, folder, sort]);

  const folderOptions = useMemo(() => {
    const set = new Set(folders);
    assets.forEach((a) => set.add(a.folder));
    return Array.from(set).sort();
  }, [folders, assets]);

  return (
    <div className="space-y-4">
      <MediaToolbar
        search={search}
        onSearchChange={setSearch}
        folder={folder}
        onFolderChange={setFolder}
        folders={folderOptions}
        sort={sort}
        onSortChange={setSort}
        onUploadClick={() => setShowUpload(true)}
      />

      <MediaGrid assets={assets} onSelect={setSelected} />

      {showUpload && (
        <MediaUploadModal
          folders={folderOptions}
          onClose={() => setShowUpload(false)}
          onUploaded={(asset) => {
            setAssets((prev) => [asset, ...prev]);
            setFolders((prev) => (prev.includes(asset.folder) ? prev : [...prev, asset.folder]));
          }}
        />
      )}

      {selected && (
        <MediaDetailModal
          asset={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setSelected(updated);
          }}
          onDeleted={() => {
            setAssets((prev) => prev.filter((a) => a.id !== selected.id));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
