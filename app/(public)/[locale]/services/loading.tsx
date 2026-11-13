import { Bar, CenteredHero, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors ServicesPageClient: centred hero, then alternating two-column
// service sections (icon, title, copy, feature rows | visual card).
export default function ServicesLoading() {
  return (
    <SkeletonRoot label="Loading services">
      <CenteredHero />
      {[0, 1].map((i) => (
        <section key={i} className={`py-20 lg:py-24 ${i % 2 === 0 ? "bg-background" : "bg-card"}`}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <Bar className="mb-6 h-16 w-16 rounded-2xl" />
                <Bar className="mb-3 h-9 w-3/4 rounded-xl lg:h-10" />
                <Bar className="mb-2 h-6 w-1/2" />
                <div className="mb-8 space-y-2">
                  <Bar className="h-4 w-full" />
                  <Bar className="h-4 w-full" />
                  <Bar className="h-4 w-2/3" />
                </div>
                <div className="mb-8 space-y-3">
                  {[0, 1, 2, 3].map((r) => (
                    <div key={r} className="flex items-center gap-3">
                      <Bar className="h-5 w-5 rounded-full" />
                      <Bar className="h-4 w-56 max-w-[70%]" />
                    </div>
                  ))}
                </div>
                <Bar className="h-12 w-44 rounded-xl" />
              </div>
              <Bar className="h-80 w-full rounded-3xl" />
            </div>
          </div>
        </section>
      ))}
    </SkeletonRoot>
  );
}
