// next/image custom loader (next.config.ts → images.loaderFile).
//
// OpenNext on Cloudflare has no image optimizer unless an IMAGES binding is
// added: /_next/image just returns the original file, whatever width the
// browser asks for. So images are resized by the services that hold them:
//
// - Cloudinary URLs (CMS images): Cloudinary resizes and picks the format
//   (f_auto: AVIF/WebP/JPEG per browser) and quality (q_auto). The browser
//   loads them straight from Cloudinary's CDN.
// - Same-site files (/public, static imports under /_next/static/media):
//   Cloudflare Image Transformations via /cdn-cgi/image/. Needs
//   "Transformations" enabled on the tbjgrowthtech.com zone (Cloudflare
//   dashboard → Images → Transformations). Results are cached at Cloudflare's
//   edge. /cdn-cgi/ only works on that zone: on *.workers.dev these images
//   404, and `next dev` has no /cdn-cgi/, so development serves the original.
// - images.unsplash.com: Unsplash's own resize parameters.
// - Anything else (e.g. picsum.photos placeholders): returned unchanged.
//
// Quality: static files default to 85 (Cloudflare's own default; side by
// side with the originals there was no visible difference), Cloudinary to
// q_auto. A `quality` prop on <Image> overrides both.

type LoaderArgs = { src: string; width: number; quality?: number };

const STATIC_QUALITY = 85;

// One Cloudinary transformation component, e.g. "f_auto,q_auto,w_640" or "c_fill,g_face,h_200".
// Keys are Cloudinary's image parameter names, so a folder such as "my_folder" isn't mistaken for one.
const KEY = "(?:a|ac|af|ar|b|bo|br|c|co|cs|d|dl|dn|dpr|du|e|eo|f|fl|fn|fps|g|h|ki|l|o|pg|q|r|so|sp|t|u|vc|w|x|y|z)";
const CLOUDINARY_TRANSFORM = new RegExp(`^${KEY}_[^/,]+(,${KEY}_[^/,]+)*$`);
// Components lib/cloudinary-url.ts adds, which this loader replaces with its own.
const OWN_TRANSFORM = /^(f_auto|q_auto|w_\d+)(,(f_auto|q_auto|w_\d+))*$/;

function cloudinary(src: string, width: number, quality?: number): string | null {
  const marker = "/image/upload/";
  const at = src.indexOf(marker);
  if (at === -1 || !src.startsWith("https://res.cloudinary.com/")) return null;
  const head = src.slice(0, at + marker.length);
  const parts = src.slice(at + marker.length).split("/");
  // Keep any transformations stored in the URL (crops etc.) and resize after
  // them; drop the ones cloudinaryUrl() added so they aren't applied twice.
  let i = 0;
  const kept: string[] = [];
  while (i < parts.length - 1 && CLOUDINARY_TRANSFORM.test(parts[i])) {
    if (!OWN_TRANSFORM.test(parts[i])) kept.push(parts[i]);
    i++;
  }
  // c_limit: never upscale past the original.
  const ours = `f_auto,${quality ? `q_${quality}` : "q_auto"},c_limit,w_${width}`;
  return head + [...kept, ours, ...parts.slice(i)].join("/");
}

function unsplash(src: string, width: number, quality?: number): string | null {
  if (!src.startsWith("https://images.unsplash.com/")) return null;
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 80));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  const remote = cloudinary(src, width, quality) ?? unsplash(src, width, quality);
  if (remote) return remote;

  if (src.startsWith("/") && !src.startsWith("//")) {
    if (process.env.NODE_ENV === "development") {
      // No /cdn-cgi/ locally. The width parameter only keeps next/image from
      // warning that the loader ignores width; static files ignore it.
      return `${src}${src.includes("?") ? "&" : "?"}w=${width}`;
    }
    const options = `width=${width},quality=${quality ?? STATIC_QUALITY},format=auto,fit=scale-down`;
    return `/cdn-cgi/image/${options}${src}`;
  }

  return src;
}

// Widths for plain <img> srcset (CMS block images): next/image's own sizes, capped at 1920.
const SRCSET_WIDTHS = [256, 384, 640, 828, 1080, 1200, 1920];

/** src/srcSet for a plain <img>, using the same loader. No srcSet when the URL can't be resized. */
export function responsiveImgProps(src: string): { src: string; srcSet?: string } {
  const probe = imageLoader({ src, width: 1080 });
  if (probe === src) return { src };
  return {
    src: probe,
    srcSet: SRCSET_WIDTHS.map((w) => `${imageLoader({ src, width: w })} ${w}w`).join(", "),
  };
}
