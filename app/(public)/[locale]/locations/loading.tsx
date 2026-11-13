import { Bar, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors the locations index: max-w-4xl, h1, then a 1/2-column card grid.
export default function LocationsLoading() {
  return (
    <SkeletonRoot label="Loading locations" className="pb-16 pt-32 lg:pb-20 lg:pt-40">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Bar className="mb-8 h-9 w-56 rounded-xl sm:h-10" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-[98px] w-full rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}
