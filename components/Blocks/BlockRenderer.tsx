import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { faqPageSchema } from "@/lib/schema";
import { isDisplayableImageUrl } from "@/lib/image-hosts";
import { isSafeHref } from "@/lib/blocks/schema";
import { sanitizeRichText } from "@/lib/sanitize";
import type { RenderedBlock } from "@/lib/blocks/load";
import LeadFormBlock from "./LeadFormBlock";

// Renders landing-page blocks. Output safety, in one place:
//  - all text is rendered as React text children (escaped); the only HTML is the richText block, which is sanitized
//    again here even though it was sanitized on save and again in parseStoredBlocks;
//  - every href goes through <BlockLink>, which re-checks isSafeHref() and renders nothing for an unsafe URL;
//  - every image must be same-site or an allowed host (the CSP's img-src), otherwise it is skipped.

const btnPrimary = "inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-orange-deep text-white font-semibold hover:bg-brand-orange transition-colors";
const btnSecondary = "inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-tint transition-colors";

function BlockLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (!isSafeHref(href)) return null;
  const external = /^(https?:|mailto:|tel:)/i.test(href);
  if (external) {
    return (
      <a href={href} className={className} {...(/^https?:/i.test(href) ? { rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return href.startsWith("#") ? <a href={href} className={className}>{children}</a> : <Link href={href} className={className}>{children}</Link>;
}

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src || !isDisplayableImageUrl(src)) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}

function SectionHeading({ id, heading, intro }: { id: string; heading: string; intro?: string }) {
  if (!heading && !intro) return null;
  return (
    <div className="max-w-3xl mx-auto text-center mb-10">
      {heading && <h2 id={id} className="text-2xl md:text-4xl font-bold text-foreground">{heading}</h2>}
      {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
    </div>
  );
}

const GRID_COLS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" };

function BlockView({ rendered, h1, source, underNav }: { rendered: RenderedBlock; h1: boolean; source: string; underNav: boolean }) {
  const { block } = rendered;
  const hid = `block-${block.id}`;

  switch (block.type) {
    case "hero": {
      const d = block.data;
      const Heading = h1 ? "h1" : "h2";
      return (
        <section className={`px-4 sm:px-6 lg:px-8 pb-16 md:pb-24 bg-tint ${underNav ? "pt-32 md:pt-40" : "pt-16 md:pt-24"}`}>
          <div className={`max-w-6xl mx-auto grid gap-10 items-center ${d.imageUrl && isDisplayableImageUrl(d.imageUrl) ? "lg:grid-cols-2" : "text-center"}`}>
            <div className={d.imageUrl && isDisplayableImageUrl(d.imageUrl) ? "" : "max-w-3xl mx-auto"}>
              {d.eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light mb-3">{d.eyebrow}</p>}
              <Heading className="text-3xl md:text-5xl font-bold text-foreground leading-tight">{d.heading}</Heading>
              {d.subheading && <p className="mt-5 text-lg md:text-xl text-muted">{d.subheading}</p>}
              {(d.primaryCtaHref || d.secondaryCtaHref) && (
                <div className={`mt-8 flex flex-wrap gap-3 ${d.imageUrl && isDisplayableImageUrl(d.imageUrl) ? "" : "justify-center"}`}>
                  {d.primaryCtaHref && <BlockLink href={d.primaryCtaHref} className={btnPrimary}>{d.primaryCtaLabel}</BlockLink>}
                  {d.secondaryCtaHref && <BlockLink href={d.secondaryCtaHref} className={btnSecondary}>{d.secondaryCtaLabel}</BlockLink>}
                </div>
              )}
            </div>
            <Img src={d.imageUrl} alt={d.imageAlt} className="w-full rounded-2xl" />
          </div>
        </section>
      );
    }

    case "richText":
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="prose prose-lg dark:prose-invert max-w-3xl mx-auto prose-headings:font-bold prose-a:text-brand-orange-deep dark:prose-a:text-brand-orange-light prose-pre:overflow-x-auto prose-img:rounded-2xl">
            <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.data.html) }} />
          </div>
        </section>
      );

    case "cta": {
      const d = block.data;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto rounded-3xl border border-border bg-card p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-4xl font-bold text-foreground">{d.heading}</h2>
            {d.text && <p className="mt-4 text-lg text-muted max-w-2xl mx-auto">{d.text}</p>}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <BlockLink href={d.buttonHref} className={btnPrimary}>{d.buttonLabel}</BlockLink>
              {d.secondaryHref && <BlockLink href={d.secondaryHref} className={btnSecondary}>{d.secondaryLabel}</BlockLink>}
            </div>
          </div>
        </section>
      );
    }

    case "cards": {
      const d = block.data;
      if (d.items.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={d.heading ? hid : undefined}>
          <div className="max-w-6xl mx-auto">
            <SectionHeading id={hid} heading={d.heading} intro={d.intro} />
            <ul className={`grid gap-6 ${GRID_COLS[d.columns] ?? GRID_COLS[3]}`}>
              {d.items.map((item, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                  {item.text && <p className="mt-2 text-muted flex-1">{item.text}</p>}
                  {item.href && (
                    <BlockLink href={item.href} className="mt-4 font-semibold text-brand-orange-deep dark:text-brand-orange-light hover:underline">
                      {item.linkLabel || "Learn more"} →
                    </BlockLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case "testimonials": {
      const items = rendered.testimonials ?? [];
      if (items.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={block.data.heading ? hid : undefined}>
          <div className="max-w-6xl mx-auto">
            <SectionHeading id={hid} heading={block.data.heading} />
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => (
                <li key={t.id}>
                  <figure className="h-full rounded-2xl border border-border bg-card p-6 flex flex-col">
                    <div className="text-brand-orange" aria-label={`${t.rating} out of 5 stars`}>{"★".repeat(Math.max(0, Math.min(5, t.rating)))}</div>
                    <blockquote className="mt-3 text-foreground flex-1">“{t.quote}”</blockquote>
                    <figcaption className="mt-4 text-sm text-muted">
                      <span className="font-semibold text-foreground">{t.clientName}</span>
                      {(t.role || t.company) && <> — {[t.role, t.company].filter(Boolean).join(", ")}</>}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case "faq": {
      const items = rendered.faqs ?? [];
      if (items.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={block.data.heading ? hid : undefined}>
          <div className="max-w-3xl mx-auto">
            <SectionHeading id={hid} heading={block.data.heading} />
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map((f, i) => (
                <details key={i} className="group p-5">
                  <summary className="cursor-pointer font-semibold text-foreground list-none flex justify-between gap-4">
                    {f.question}
                    <span aria-hidden className="text-brand-orange transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-muted whitespace-pre-line">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "pricing": {
      const packages = rendered.packages ?? [];
      if (packages.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={block.data.heading ? hid : undefined}>
          <div className="max-w-6xl mx-auto">
            <SectionHeading id={hid} heading={block.data.heading} intro={block.data.intro} />
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {packages.map((p) => (
                <li key={p.slug} className={`rounded-2xl border bg-card p-6 flex flex-col ${p.isMostPopular ? "border-brand-orange ring-1 ring-brand-orange" : "border-border"}`}>
                  {p.isMostPopular && <span className="self-start mb-3 rounded-full bg-brand-orange-deep px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                  <h3 className="text-xl font-semibold text-foreground">{p.name}</h3>
                  {p.tagline && <p className="mt-1 text-muted">{p.tagline}</p>}
                  {p.prices.length > 0 && (
                    <p className="mt-4">
                      <span className="text-3xl font-bold text-foreground">{p.prices[0].monthly}</span>
                      <span className="text-muted"> / month</span>
                      {p.prices.length > 1 && <span className="block text-sm text-caption">{p.prices.slice(1).map((x) => x.monthly).join(" · ")}</span>}
                    </p>
                  )}
                  <ul className="mt-5 space-y-2 text-sm text-muted flex-1">
                    {p.features.map((f, i) => (
                      <li key={i}>
                        <span className="font-semibold text-foreground">{f.label}</span>
                        {f.text && <>: {f.text}</>}
                      </li>
                    ))}
                  </ul>
                  {p.ctaLink && p.ctaLabel && <BlockLink href={p.ctaLink} className={`${btnPrimary} mt-6`}>{p.ctaLabel}</BlockLink>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case "trustBadges": {
      const d = block.data;
      if (d.items.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-10" aria-labelledby={d.heading ? hid : undefined}>
          <div className="max-w-6xl mx-auto">
            <SectionHeading id={hid} heading={d.heading} />
            <ul className="flex flex-wrap items-center justify-center gap-4">
              {d.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground">
                  <Img src={item.imageUrl} alt={item.imageAlt} className="h-8 w-auto" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case "leadForm": {
      const d = block.data;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-16 bg-tint">
          <LeadFormBlock
            heading={d.heading}
            text={d.text}
            submitLabel={d.submitLabel}
            successMessage={d.successMessage}
            showPhone={d.showPhone}
            showCompany={d.showCompany}
            showMessage={d.showMessage}
            source={source}
            headingId={hid}
          />
        </section>
      );
    }
  }
}

/**
 * `pageTitle` becomes the visible <h1> when no hero block provides one, so every blocks page has exactly one h1.
 * `source` is saved on leads submitted through a lead-form block.
 */
export default function BlockRenderer({ blocks, pageTitle, source }: { blocks: RenderedBlock[]; pageTitle?: string; source: string }) {
  const firstHero = blocks.findIndex((b) => b.block.type === "hero");
  // One FAQPage object for the whole page, however many FAQ blocks it has (duplicate FAQPage markup is invalid).
  const faqEntries = blocks.flatMap((b) => (b.block.type === "faq" ? b.faqs ?? [] : []));
  return (
    <>
      {faqEntries.length > 0 && <JsonLd schema={faqPageSchema(faqEntries)} />}
      {pageTitle && firstHero === -1 && (
        <h1 className="px-4 pt-8 text-3xl md:text-5xl font-bold text-foreground leading-tight text-center">{pageTitle}</h1>
      )}
      {blocks.map((rendered, i) => (
        <BlockView key={`${rendered.block.id}-${i}`} rendered={rendered} h1={i === firstHero && Boolean(pageTitle)} source={source} underNav={i === 0 && Boolean(pageTitle)} />
      ))}
    </>
  );
}
