import { Bar, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors the home Hero: full-viewport section, two columns on desktop.
export default function HomeLoading() {
  return (
    <SkeletonRoot label="Loading home page">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Bar className="mb-6 h-9 w-52 rounded-full" />
              <Bar className="mb-3 h-12 w-full rounded-xl sm:h-14 lg:h-16" />
              <Bar className="mb-3 h-12 w-5/6 rounded-xl sm:h-14 lg:h-16" />
              <Bar className="mb-8 h-12 w-2/3 rounded-xl sm:h-14 lg:h-16" />
              <div className="mb-8 space-y-2">
                <Bar className="h-5 w-full max-w-xl" />
                <Bar className="h-5 w-4/5 max-w-xl" />
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Bar className="h-[58px] w-full rounded-2xl sm:w-52" />
                <Bar className="h-[58px] w-full rounded-2xl sm:w-44" />
              </div>
            </div>
            <Bar className="hidden aspect-[4/3] w-full rounded-3xl lg:block" />
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}
