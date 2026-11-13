import { Bar, CardBlock, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors AboutPageClient: two-column hero (copy + stats left, photo right),
// then the values grid.
export default function AboutLoading() {
  return (
    <SkeletonRoot label="Loading about page">
      <section className="relative pb-16 pt-32 lg:pb-20 lg:pt-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Bar className="mb-6 h-9 w-32 rounded-full" />
              <Bar className="mb-3 h-11 w-full rounded-xl sm:h-12" />
              <Bar className="mb-6 h-11 w-4/5 rounded-xl sm:h-12" />
              <div className="mb-8 space-y-2">
                <Bar className="h-5 w-full" />
                <Bar className="h-5 w-full" />
                <Bar className="h-5 w-3/4" />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Bar key={i} className="h-[104px] rounded-2xl" />
                ))}
              </div>
            </div>
            <Bar className="aspect-[4/3] w-full rounded-3xl" />
          </div>
        </div>
      </section>
      <section className="py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Bar className="mx-auto mb-4 h-10 w-72 rounded-xl" />
            <Bar className="mx-auto h-5 w-full" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <CardBlock key={i} className="h-48" />
            ))}
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}
