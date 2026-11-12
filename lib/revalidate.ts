import { revalidatePath as nextRevalidatePath, revalidateTag } from "next/cache";
import { SEO_FILES_CACHE_TAG } from "@/lib/seo-files-cache";

// Every public page lives under app/(public)/[locale]/..., and Next.js tags a
// cached page by that route (route group and dynamic segment included) plus
// the internal, locale-prefixed pathname ("/en-gb/blog", never "/blog").
// So revalidatePath("/blog") or revalidatePath("/services/[slug]", "page")
// match no cached page at all: the tags they produce don't exist.
//
// Public content is also cross-referenced everywhere (related posts, featured
// case studies on the home page, hreflang alternates, translated slugs, the
// footer), so a per-path purge misses pages even when the tag is right.
// An admin edit therefore marks the whole public site stale with one tag.
// Each page is then re-rendered once, on its next visit, and cached again.
//
// The same call also expires the cached sitemaps and robots.txt rules
// (lib/seo-files-cache.ts): they live outside the [locale] tree, so the
// layout path above doesn't reach them. `expire: 0` means the next request
// rebuilds them instead of being served the old copy once more.
const PUBLIC_SITE_LAYOUT = "/(public)/[locale]";

/** Marks every cached public page, sitemap and robots.txt stale. Call after any change that public pages can show. */
export function revalidatePublicSite() {
  nextRevalidatePath(PUBLIC_SITE_LAYOUT, "layout");
  revalidateTag(SEO_FILES_CACHE_TAG, { expire: 0 });
}

/**
 * Drop-in for next/cache's revalidatePath. Admin paths pass straight through;
 * any other path is a public one and refreshes the whole public site.
 */
export function revalidatePath(path: string, type?: "layout" | "page") {
  if (path === "/admin" || path.startsWith("/admin/")) {
    nextRevalidatePath(path, type);
    return;
  }
  revalidatePublicSite();
}
