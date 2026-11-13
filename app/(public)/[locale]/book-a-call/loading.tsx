import { CardBlock, CenteredHero, SkeletonRoot } from "@/components/PublicSkeleton";

// Mirrors BookACallClient: narrow (max-w-4xl) centred hero, then the booking card.
export default function BookACallLoading() {
  return (
    <SkeletonRoot label="Loading booking page" className="min-h-screen">
      <CenteredHero maxWidth="max-w-4xl" bottom="pb-12 lg:pb-16" lead="max-w-xl" />
      <section className="pb-24 lg:pb-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <CardBlock className="h-[520px]" />
        </div>
      </section>
    </SkeletonRoot>
  );
}
