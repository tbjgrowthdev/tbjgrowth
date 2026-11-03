import NewsletterForm from "@/components/NewsletterForm";
import type { BlogStrings } from "@/lib/blog-strings";

/** Dark newsletter band for the blog listing. Uses the same form as the footer. */
export default function NewsletterBand({ strings }: { strings: BlogStrings }) {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-20">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-charcoal px-6 py-14 text-center text-white sm:px-12 sm:py-16 dark:bg-gradient-to-br dark:from-brand-700 dark:via-brand-600 dark:via-85% dark:to-brand-500">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-24 -top-32 -z-10 h-[420px] w-[420px] rounded-full dark:hidden bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-brand-500)_40%,transparent),transparent)]"
        />
        {/* Dark mode: soft translucent circle in the top-right corner */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-20 -top-24 -z-10 hidden h-72 w-72 rounded-full bg-white/12 dark:block"
        />
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-bold sm:text-4xl">{strings.newsletterTitle}</h2>
          <p className="mt-3 text-base text-cream/70 sm:text-lg dark:text-brand-100">{strings.newsletterBody}</p>
          <div className="mt-8 text-start">
            <NewsletterForm
              variant="band"
              copy={{
                emailLabel: strings.emailLabel,
                placeholder: strings.emailPlaceholder,
                subscribe: strings.subscribe,
                success: strings.subscribed,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
