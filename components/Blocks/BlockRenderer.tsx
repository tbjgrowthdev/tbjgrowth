import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { faqPageSchema } from "@/lib/schema";
import { isDisplayableImageUrl } from "@/lib/image-hosts";
import { isSafeHref } from "@/lib/blocks/schema";
import { sanitizeRichText } from "@/lib/sanitize";
import { hasQuote, tableIsRenderable, visibleProofItems } from "@/lib/blocks/visible";
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
                  {d.variant === "steps" && (
                    <span aria-hidden className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange-deep text-sm font-bold text-white">{i + 1}</span>
                  )}
                  {d.variant === "stats" ? (
                    <p className="text-4xl md:text-5xl font-bold text-brand-orange-deep dark:text-brand-orange-light">{item.title}</p>
                  ) : (
                    <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                  )}
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

    case "metricHero": {
      const d = block.data;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12 bg-tint" aria-labelledby={hid}>
          <div className="max-w-4xl mx-auto text-center">
            {d.eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light mb-3">{d.eyebrow}</p>}
            <p className="text-6xl md:text-8xl font-bold leading-none text-brand-orange-deep dark:text-brand-orange-light">{d.value}</p>
            <p id={hid} className="mt-4 text-xl md:text-2xl font-semibold text-foreground">{d.label}</p>
            {d.from && d.to && (
              <p className="mt-3 text-lg text-muted">
                <span>{d.from}</span>
                <span aria-label="to" className="mx-3 text-brand-orange">&rarr;</span>
                <span className="font-semibold text-foreground">{d.to}</span>
              </p>
            )}
            {d.caption && <p className="mt-4 text-muted max-w-2xl mx-auto">{d.caption}</p>}
          </div>
        </section>
      );
    }

    case "factsStrip": {
      const items = block.data.items;
      if (items.length === 0) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-8">
          <dl className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {items.map((item, i) => (
              <div key={i} className="bg-card p-5">
                <dt className="text-xs font-semibold uppercase tracking-wider text-caption">{item.label}</dt>
                <dd className="mt-1 font-semibold text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    }

    case "dataTable": {
      const d = block.data;
      if (!tableIsRenderable(d.columns, d.rows)) return null;
      const last = d.columns.length - 1;
      const emphasis = (c: number) => (d.highlightLastColumn && c === last && last > 0 ? "bg-tint font-bold text-brand-orange-deep dark:text-brand-orange-light" : "");
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={d.heading ? hid : undefined}>
          <div className="max-w-4xl mx-auto">
            <SectionHeading id={hid} heading={d.heading} intro={d.intro} />
            <div className="overflow-x-auto rounded-2xl border border-border bg-card" tabIndex={0} role="region" aria-label={d.heading || "Data table"}>
              <table className="w-full min-w-[32rem] text-left text-sm md:text-base">
                <thead>
                  <tr className="border-b border-border">
                    {d.columns.map((c, i) => (
                      <th key={i} scope="col" className={`px-4 py-3 font-semibold text-foreground ${emphasis(i)}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.rows.map((row, r) => (
                    <tr key={r}>
                      {d.columns.map((_, c) =>
                        c === 0 ? (
                          <th key={c} scope="row" className="px-4 py-3 font-medium text-foreground">{row[c]}</th>
                        ) : (
                          <td key={c} className={`px-4 py-3 text-muted ${emphasis(c)}`}>{row[c]}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d.footnote && <p className="mt-3 text-sm text-caption">{d.footnote}</p>}
          </div>
        </section>
      );
    }

    case "proofGallery": {
      const d = block.data;
      // Items without a displayable image are skipped; with none left the whole block (heading too) is hidden.
      const items = visibleProofItems(d.items);
      if (items.length === 0) return null;
      const cols = d.columns === 1 ? "" : d.columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12" aria-labelledby={d.heading ? hid : undefined}>
          <div className={`mx-auto ${d.columns === 1 ? "max-w-3xl" : "max-w-6xl"}`}>
            <SectionHeading id={hid} heading={d.heading} />
            <ul className={`grid gap-6 ${cols}`}>
              {items.map((item, i) => (
                <li key={i}>
                  <figure className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="relative">
                      <Img src={item.imageUrl} alt={item.imageAlt || item.caption} className="w-full" />
                      {item.badge && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{item.badge}</span>}
                    </div>
                    {item.caption && <figcaption className="p-4 text-sm text-muted">{item.caption}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    }

    case "pullQuote": {
      const d = block.data;
      if (!hasQuote(d.quote)) return null;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12">
          <figure className="max-w-3xl mx-auto rounded-2xl border-l-4 border-brand-orange bg-card p-6 md:p-10">
            <blockquote className="text-xl md:text-2xl font-medium leading-relaxed text-foreground">&ldquo;{d.quote}&rdquo;</blockquote>
            {(d.name || d.role) && (
              <figcaption className="mt-5 text-sm text-muted">
                {d.name && <span className="font-semibold text-foreground">{d.name}</span>}
                {d.name && d.role && " — "}
                {d.role}
              </figcaption>
            )}
          </figure>
        </section>
      );
    }

    case "takeaway": {
      const d = block.data;
      return (
        <section className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-4xl mx-auto rounded-3xl bg-brand-orange-deep p-8 md:p-12 text-white">
            {d.label && <p className="text-sm font-semibold uppercase tracking-wider text-white/80">{d.label}</p>}
            <p className="mt-3 text-2xl md:text-4xl font-bold leading-snug">{d.text}</p>
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
