import { ArticleSkeleton } from "@/components/PublicSkeleton";

// Fallback for any [locale] route without its own loading.tsx (CMS pages at
// /[slug], programmatic-SEO pages): a generic hero + article column.
export default function LocaleLoading() {
  return <ArticleSkeleton />;
}
