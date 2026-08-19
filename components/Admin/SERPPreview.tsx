import React from 'react';

interface SERPPreviewProps {
  title: string;
  description: string;
  slug: string;
}

export default function SERPPreview({ title, description, slug }: SERPPreviewProps) {
  // Fallbacks if empty
  const displayTitle = title || "Your Page Title - TBJ Growth";
  const displayUrl = `https://tbjgrowth.com/${slug || "your-page-slug"}`;
  const displayDesc = description || "This is a placeholder meta description. Write a compelling description to improve your click-through rate in search results.";

  return (
    <div className="bg-white p-4 rounded border border-gray-200 shadow-sm font-sans max-w-[600px]">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs overflow-hidden">
          {/* Favicon placeholder */}
          <span className="text-gray-500 font-bold">TBJ</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[14px] text-[#202124] leading-tight">TBJ Growth</span>
          <span className="text-[12px] text-[#4d5156] leading-tight">{displayUrl}</span>
        </div>
      </div>
      <div className="text-[20px] text-[#1a0dab] hover:underline cursor-pointer leading-tight mb-1 truncate">
        {displayTitle}
      </div>
      <div className="text-[14px] text-[#4d5156] leading-[1.58] line-clamp-2">
        {displayDesc}
      </div>
    </div>
  );
}
