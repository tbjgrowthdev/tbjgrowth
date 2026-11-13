import { ArticleSkeleton } from "@/components/PublicSkeleton";

// Detail pages must not inherit the parent listing skeleton (different layout).
export default function DetailLoading() {
  return <ArticleSkeleton />;
}
