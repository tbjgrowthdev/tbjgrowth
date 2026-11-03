// Shown while the listing renders on navigation: the dark hero shell plus card skeletons.
export default function BlogLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading articles">
      <div className="bg-charcoal pb-16 pt-32 lg:pt-40">
        <div className="mx-auto max-w-[860px] px-6 text-center">
          <div className="mx-auto h-8 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="mx-auto mt-6 h-14 w-full max-w-[560px] animate-pulse rounded-2xl bg-white/10" />
          <div className="mx-auto mt-9 h-[58px] max-w-[680px] animate-pulse rounded-full bg-white/20" />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1200px] gap-6 px-6 py-16 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[22px] border border-border bg-card">
            <div className="aspect-[16/10] animate-pulse bg-tint" />
            <div className="space-y-3 p-6">
              <div className="h-3 w-20 animate-pulse rounded bg-tint" />
              <div className="h-6 w-full animate-pulse rounded bg-tint" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-tint" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
