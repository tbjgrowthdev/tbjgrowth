import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * next/image requires src to be an absolute URL or start with "/".
 * Guards against stale/malformed values (e.g. legacy "placeholder_url" rows).
 */
export function isValidImageSrc(src: unknown): src is string {
  if (typeof src !== "string" || src.length === 0) return false;
  if (src.startsWith("/")) return true;
  try {
    new URL(src);
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes a string into a URL-safe slug: lowercase, trimmed, non-alphanumeric
 * runs collapsed to single hyphens, no leading/trailing hyphens. Guards against
 * malformed slugs (trailing spaces, mixed case) that browsers/routers normalize
 * away, causing an exact-match DB lookup to silently 404.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Parses the JSON stored in User.socialLinks, defaulting missing/invalid values to "". */
export function parseSocialLinks(raw: string | null | undefined) {
  if (!raw) return { website: "", twitter: "", linkedin: "" };
  try {
    const parsed = JSON.parse(raw);
    return {
      website: parsed.website || "",
      twitter: parsed.twitter || "",
      linkedin: parsed.linkedin || "",
    };
  } catch {
    return { website: "", twitter: "", linkedin: "" };
  }
}

/** Estimates reading time (minutes) for HTML content, stripping tags before counting words. */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
