// Building blocks for the public site's loading.tsx files. Each route's
// skeleton mirrors that page's real hero/section dimensions (same container
// widths, same top padding, same card heights) so the swap to the real page
// causes no layout shift. They render inside the [locale] layout, so the
// navbar and footer stay mounted and only the page body is replaced.

import type { ReactNode } from "react";

/** One pulsing placeholder block. `className` sets its size/shape. */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-tint motion-reduce:animate-none ${className}`} />;
}

/** Wrapper that announces the loading state once and hides the blocks from screen readers. */
export function SkeletonRoot({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`bg-background ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/**
 * The centred hero used by Services, Contact and Book-a-call:
 * `pt-32 lg:pt-40 pb-16 lg:pb-20`, pill, one-line h1, two-line lead.
 */
export function CenteredHero({
  maxWidth = "max-w-7xl",
  bottom = "pb-16 lg:pb-20",
  lead = "max-w-2xl",
}: {
  maxWidth?: string;
  bottom?: string;
  lead?: string;
}) {
  return (
    <section className={`relative pt-32 lg:pt-40 ${bottom}`}>
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 text-center ${maxWidth}`}>
        <Bar className="mx-auto mb-6 h-9 w-36 rounded-full" />
        <Bar className="mx-auto mb-4 h-10 w-64 sm:h-12 sm:w-80 lg:h-[60px] lg:w-96 rounded-xl" />
        <div className={`mx-auto space-y-2 ${lead}`}>
          <Bar className="h-5 w-full" />
          <Bar className="mx-auto h-5 w-3/4" />
        </div>
      </div>
    </section>
  );
}

/** A bordered card block, as used by the content sections. */
export function CardBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl border border-border bg-card motion-reduce:animate-none ${className}`} />;
}

/**
 * Generic detail page (service / case study / location / blog post / CMS
 * page): dark-free hero with a title block, then a readable article column.
 */
export function ArticleSkeleton({ label = "Loading page" }: { label?: string }) {
  return (
    <SkeletonRoot label={label}>
      <section className="pt-32 pb-10 lg:pt-40 lg:pb-14">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Bar className="mb-5 h-4 w-48" />
          <Bar className="mb-4 h-10 w-full sm:h-12" />
          <Bar className="mb-6 h-10 w-2/3 sm:h-12" />
          <div className="space-y-2">
            <Bar className="h-5 w-full" />
            <Bar className="h-5 w-5/6" />
          </div>
        </div>
      </section>
      <section className="pb-20 lg:pb-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Bar className="mb-10 aspect-[16/9] w-full rounded-3xl" />
          <div className="space-y-3">
            {["w-full", "w-[96%]", "w-full", "w-[88%]", "w-full", "w-3/4"].map((w, i) => (
              <Bar key={i} className={`h-4 ${w}`} />
            ))}
            <div className="pt-6" />
            {["w-full", "w-[92%]", "w-full", "w-4/5"].map((w, i) => (
              <Bar key={`b${i}`} className={`h-4 ${w}`} />
            ))}
          </div>
        </div>
      </section>
    </SkeletonRoot>
  );
}
