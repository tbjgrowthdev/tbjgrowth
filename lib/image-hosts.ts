// The external hosts the site is allowed to show images from. next.config.ts
// builds both the CSP `img-src` directive and next/image's remotePatterns
// from this list, and the admin image field (components/Admin/Media/
// ImageInput.tsx) uses it to warn when a pasted URL points anywhere else —
// such an image would be blocked on the public site, so the field offers to
// import a copy into the Media Library (Cloudinary) instead.
export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com", "picsum.photos", "images.unsplash.com"] as const;

/** True when the site can display `src` as-is: a same-site path, data/blob URL, or an allowed https host. */
export function isDisplayableImageUrl(src: string): boolean {
  const value = src.trim();
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (value.startsWith("data:image/") || value.startsWith("blob:")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

/** True for an absolute http(s) URL — something that could be imported into the Media Library. */
export function isImportableImageUrl(src: string): boolean {
  try {
    const url = new URL(src.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
