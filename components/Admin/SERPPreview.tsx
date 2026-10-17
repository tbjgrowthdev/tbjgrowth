"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

interface SERPPreviewProps {
  title: string;
  description: string;
  slug: string;
}

// Same thresholds SEOScorePanel.tsx already uses for its own title/description
// length checks — kept identical here so the two panels never disagree about
// what "good" means for the same field.
const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 160;

type LengthStatus = "empty" | "good" | "warning";

function lengthStatus(length: number, min: number, max: number): LengthStatus {
  if (length === 0) return "empty";
  return length > min && length <= max ? "good" : "warning";
}

function LengthCounter({ label, length, max, status }: { label: string; length: number; max: number; status: LengthStatus }) {
  const color = status === "good" ? "text-green-600 dark:text-green-400" : status === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-caption">{label}</span>
      <span className={`font-mono ${color}`}>
        {length} / {max}
      </span>
    </div>
  );
}

export default function SERPPreview({ title, description, slug }: SERPPreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const displayTitle = title || "Your Page Title - TBJ Growth";
  const displayUrl = `https://tbjgrowth.com/${slug || "your-page-slug"}`;
  const displayDesc = description || "This is a placeholder meta description. Write a compelling description to improve your click-through rate in search results.";

  const titleStatus = lengthStatus(title.length, TITLE_MIN, TITLE_MAX);
  const descStatus = lengthStatus(description.length, DESCRIPTION_MIN, DESCRIPTION_MAX);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setDevice("desktop")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border ${device === "desktop" ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}
        >
          <Monitor size={14} />
          Desktop
        </button>
        <button
          type="button"
          onClick={() => setDevice("mobile")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border ${device === "mobile" ? "bg-brand-orange-deep text-white border-brand-orange-deep" : "border-border text-caption"}`}
        >
          <Smartphone size={14} />
          Mobile
        </button>
      </div>

      {device === "desktop" ? (
        <div className="bg-white p-4 rounded border border-gray-200 shadow-sm font-sans max-w-[600px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs overflow-hidden shrink-0">
              <span className="text-gray-500 font-bold text-[10px]">TBJ</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] text-[#202124] leading-tight">TBJ Growth</span>
              <span className="text-[12px] text-[#4d5156] leading-tight">{displayUrl}</span>
            </div>
          </div>
          <div className="text-[20px] text-[#1a0dab] hover:underline cursor-pointer leading-tight mb-1 line-clamp-2">{displayTitle}</div>
          <div className="text-[14px] text-[#4d5156] leading-[1.58] line-clamp-2">{displayDesc}</div>
        </div>
      ) : (
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm font-sans max-w-[375px]">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              <span className="text-gray-500 font-bold text-[11px]">TBJ</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] text-[#202124] leading-tight truncate">TBJ Growth</span>
              <span className="text-[12px] text-[#4d5156] leading-tight truncate">{displayUrl}</span>
            </div>
          </div>
          {/* Google's mobile SERP has rendered result titles in dark text (not the
              desktop's blue link color) since ~2020 — the whole card is the tap target. */}
          <div className="text-[18px] text-[#202124] leading-snug mb-1 line-clamp-2">{displayTitle}</div>
          <div className="text-[14px] text-[#4d5156] leading-[1.5] line-clamp-2">{displayDesc}</div>
        </div>
      )}

      <div className="space-y-1 pt-1">
        <LengthCounter label="Title length" length={title.length} max={TITLE_MAX} status={titleStatus} />
        <LengthCounter label="Description length" length={description.length} max={DESCRIPTION_MAX} status={descStatus} />
      </div>
    </div>
  );
}
