"use client";

import { Upload, Search } from "lucide-react";

export type SortOption = "newest" | "oldest" | "name" | "largest" | "smallest";

interface MediaToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  folder: string;
  onFolderChange: (value: string) => void;
  folders: string[];
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  onUploadClick: () => void;
}

export default function MediaToolbar({
  search,
  onSearchChange,
  folder,
  onFolderChange,
  folders,
  sort,
  onSortChange,
  onUploadClick,
}: MediaToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-caption" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, filename, or alt text..."
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
        />
      </div>

      <select
        value={folder}
        onChange={(e) => onFolderChange(e.target.value)}
        className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
      >
        <option value="">All folders</option>
        {folders.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        className="px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name">Name A–Z</option>
        <option value="largest">Largest</option>
        <option value="smallest">Smallest</option>
      </select>

      <button
        type="button"
        onClick={onUploadClick}
        className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors text-sm font-medium"
      >
        <Upload size={16} />
        Upload
      </button>
    </div>
  );
}
