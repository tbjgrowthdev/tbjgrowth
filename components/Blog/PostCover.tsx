import Image from "next/image";
import { isValidImageSrc, cn } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary-url";

// Light / dark gradient pairs. A post's id picks one, so the same post always
// gets the same cover and neighbouring cards rarely match.
const VARIANTS = [
  "bg-gradient-to-br from-brand-100 via-brand-200/70 to-brand-300/50 dark:from-brand-900 dark:via-brand-800/70 dark:to-charcoal",
  "bg-gradient-to-tr from-brand-200/80 via-brand-100 to-ivory dark:from-charcoal dark:via-brand-900 dark:to-brand-800/60",
  "bg-gradient-to-b from-brand-300/50 via-brand-200/60 to-brand-100 dark:from-brand-800/70 dark:via-brand-900 dark:to-charcoal",
  "bg-gradient-to-bl from-brand-100 via-brand-300/40 to-brand-200/80 dark:from-brand-900 dark:via-charcoal dark:to-brand-800/60",
];

function hashIndex(seed: string, length: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % length;
}

type PostCoverProps = {
  /** Used to pick a stable placeholder variant. */
  id: string;
  src?: string | null;
  alt: string;
  /** next/image `sizes` for real images. */
  sizes: string;
  priority?: boolean;
  /** Sizing for the frame, e.g. "aspect-[16/10]" or "h-full min-h-[340px]". */
  className?: string;
  imageClassName?: string;
};

/**
 * Post cover: the real image through next/image (Cloudinary-optimised), or a
 * branded gradient placeholder when the post has no usable image. The frame
 * reserves its own space, so nothing shifts when the image loads.
 */
export default function PostCover({ id, src, alt, sizes, priority, className, imageClassName }: PostCoverProps) {
  return (
    <div className={cn("relative overflow-hidden bg-card", className)}>
      {isValidImageSrc(src) ? (
        <Image
          src={cloudinaryUrl(src)}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div aria-hidden="true" className={cn("absolute inset-0", VARIANTS[hashIndex(id, VARIANTS.length)])}>
          <div className="cover-grid-pattern absolute inset-0" />
        </div>
      )}
    </div>
  );
}
