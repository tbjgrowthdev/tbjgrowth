import { Bar, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors PricingClient's funnel explorer: 96px top padding, 1200px wrap,
// heading block, package tabs (left, max 400px) beside the detail panel.
export default function PricingLoading() {
  return (
    <SkeletonRoot label="Loading pricing" className="min-h-screen pt-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="pb-10">
          <Bar className="mb-4 h-7 w-32 rounded-full" />
          <Bar className="mb-3 h-9 w-full max-w-md rounded-xl sm:h-10 lg:h-[53px]" />
          <Bar className="h-5 w-full max-w-xl" />
        </header>
        <div className="flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 max-w-[400px] flex-[1_1_320px] flex-col gap-3.5">
            {[0, 1, 2].map((i) => (
              <Bar key={i} className="h-[112px] w-full rounded-2xl" />
            ))}
          </div>
          <Bar className="min-h-[460px] min-w-0 flex-[999_1_460px] rounded-[28px]" />
        </div>
      </div>
    </SkeletonRoot>
  );
}
