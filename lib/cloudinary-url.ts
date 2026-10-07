// Pure string transform — no network call, no dependency on the MediaAsset
// table. Works retroactively on every Cloudinary URL already stored today,
// not just ones uploaded through the Media Library.
//
// Injects f_auto (per-browser format negotiation: AVIF/WebP/JPEG) and q_auto
// (automatic quality/compression) right after the /upload/ segment of a
// Cloudinary delivery URL, plus an optional width for a specific thumbnail
// size. Any URL that isn't a Cloudinary delivery URL (picsum.photos,
// images.unsplash.com are also allowed image hosts in next.config.ts) is
// returned unchanged.
export function cloudinaryUrl(url: string, opts?: { width?: number }): string {
  if (!url) return url;

  const marker = "/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  const transforms = ["f_auto", "q_auto"];
  if (opts?.width) {
    transforms.push(`w_${opts.width}`);
  }

  const insertAt = index + marker.length;
  return `${url.slice(0, insertAt)}${transforms.join(",")}/${url.slice(insertAt)}`;
}
