import { Bar, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors the case-studies listing: `pt-24 pb-20` shell, centred heading,
// two filter pills, then a 1/2/3-column card grid (h-48 image + p-6 body).
export default function CaseStudiesLoading() {
  return (
    <SkeletonRoot label="Loading case studies" className="min-h-screen pb-20 pt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <Bar className="mx-auto mb-6 h-10 w-80 max-w-full rounded-xl md:h-12" />
          <Bar className="mx-auto h-5 w-full" />
          <Bar className="mx-auto mt-2 h-5 w-2/3" />
        </div>
        <div className="mb-12 flex flex-col justify-center gap-4 sm:flex-row">
          <Bar className="h-[42px] w-full rounded-full sm:w-44" />
          <Bar className="h-[42px] w-full rounded-full sm:w-44" />
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Bar className="h-48 w-full rounded-none" />
              <div className="space-y-3 p-6">
                <Bar className="h-3 w-24" />
                <Bar className="h-6 w-full" />
                <Bar className="h-4 w-5/6" />
                <Bar className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonRoot>
  );
}
