import { CardBlock, CenteredHero, SkeletonRoot, Bar } from "@/components/PublicSkeleton";

// Mirrors ContactPageClient: centred hero, then a 3-column grid with the
// form card spanning two columns and the contact-info stack beside it.
export default function ContactLoading() {
  return (
    <SkeletonRoot label="Loading contact page">
      <CenteredHero lead="max-w-xl" />
      <section className="pb-20 lg:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-14">
            <CardBlock className="h-[640px] lg:col-span-2" />
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <Bar key={i} className="h-24 w-full rounded-2xl" />
              ))}
              <CardBlock className="h-56" />
            </div>
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}
