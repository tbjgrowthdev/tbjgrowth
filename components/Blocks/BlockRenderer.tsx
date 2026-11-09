import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { faqPageSchema } from "@/lib/schema";
import { isDisplayableImageUrl } from "@/lib/image-hosts";
import { isSafeHref } from "@/lib/blocks/schema";
import { sanitizeRichText } from "@/lib/sanitize";
import { hasQuote, introIsBelow, isFootnoteHtml, tableIsRenderable, visibleProofItems } from "@/lib/blocks/visible";
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

// Layouts. "default" (pages, pSEO templates) is the original look and must not change. "caseStudy" puts every block in
// ONE container that is exactly the case study header's content width (title, excerpt, meta strip, featured image), so
// all left and right edges match; blocks adapt their insides (columns, rows) to it. Headings are left-aligned with the
// frame; only "statement" blocks (metric, takeaway, call to action) are centered. Vertical rhythm is uniform.
export type BlockLayout = "default" | "caseStudy";
const FRAME = "max-w-[52rem]"; // = max-w-4xl minus the article's 2 × 2rem padding, so edges match the header
// Case study container widths by name. Today every section uses "frame"; a future per-section Width setting
// (e.g. "wide") only needs another entry here and a lookup in caseWidth().
const CASE_WIDTHS = { frame: FRAME } as const;
const caseWidth = (): string => CASE_WIDTHS.frame;

function SectionHeading({ id, heading, intro, left }: { id: string; heading: string; intro?: string; left?: boolean }) {
  if (!heading && !intro) return null;
  if (left) {
    return (
      <div className="max-w-3xl mb-5 md:mb-6">
        {heading && <h2 id={id} className="text-2xl md:text-3xl font-bold leading-tight text-foreground">{heading}</h2>}
        {intro && <p className={`${heading ? "mt-2" : ""} text-lg text-muted`}>{intro}</p>}
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto text-center mb-10">
      {heading && <h2 id={id} className="text-2xl md:text-4xl font-bold text-foreground">{heading}</h2>}
      {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
    </div>
  );
}

const GRID_COLS: Record<number, string> = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" };

function BlockView({ rendered, h1, source, underNav, cs, isLast, leadsNext, afterLead }: { rendered: RenderedBlock; h1: boolean; source: string; underNav: boolean; cs: boolean; isLast: boolean; leadsNext: boolean; afterLead: boolean }) {
  const { block } = rendered;
  const hid = `block-${block.id}`;
  // Per-layout classes; the `legacy` argument is exactly what the block used before layouts existed.
  // A short intro paragraph that leads straight into the next block sits close to it (leadsNext / afterLead).
  const sec = cs ? (leadsNext ? "pt-5 md:pt-7 pb-2" : afterLead ? "pt-2 pb-5 md:pb-7" : "py-5 md:py-7") : "py-12";
  const tint = cs ? "py-10 md:py-12" : "py-12";
  // Same container for every case study block; `legacy` is what the block used before layouts (Pages, pSEO).
  const frame = (legacy: string) => (cs ? `${caseWidth()} mx-auto` : legacy);
  const wide = frame;

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

    case "richText": {
      const html = sanitizeRichText(block.data.html);
      // A closing one-line disclaimer reads as a footnote, not as a prose section of its own.
      if (cs && isLast && isFootnoteHtml(html)) {
        return (
          <section className="px-4 sm:px-6 lg:px-8 pt-2 pb-6">
            <div className={frame("")}>
              <div className="border-t border-border pt-4 text-sm text-muted" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </section>
        );
      }
      const width = cs ? "max-w-none" : "max-w-3xl mx-auto"; // case study: fill the frame, like every other block
      const eyebrow = block.data.eyebrow;
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`}>
          <div className={frame("")}>
            {eyebrow && <p className={`${width} mb-2 text-sm font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light`}>{eyebrow}</p>}
            <div className={`prose prose-lg dark:prose-invert ${width} prose-headings:font-bold prose-a:text-brand-orange-deep dark:prose-a:text-brand-orange-light prose-pre:overflow-x-auto prose-img:rounded-2xl ${cs ? "prose-h2:text-[1.75rem] prose-h2:leading-tight" : ""}`}>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        </section>
      );
    }

    case "cta": {
      const d = block.data;
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`}>
          <div className={`${frame("max-w-4xl mx-auto")} rounded-3xl border border-border bg-card p-8 md:p-12 text-center`}>
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
      // Stat cards' intro is a note about the figures, so it goes below them (Pages keep "above" unless set explicitly).
      const below = cs ? introIsBelow(d.variant, d.introPlacement) : d.introPlacement === "below";
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={d.heading ? hid : undefined}>
          <div className={wide("max-w-6xl mx-auto")}>
            <SectionHeading id={hid} heading={d.heading} intro={below ? undefined : d.intro} left={cs} />
            {/* Case study stat cards: one row on desktop (up to 4), wrapping on mobile; other cards keep their column setting. */}
            <ul
              className={`grid gap-4 md:gap-6 ${cs && d.variant === "stats" ? "grid-cols-1 sm:grid-cols-2 md:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" : GRID_COLS[d.columns] ?? GRID_COLS[3]}`}
              style={cs && d.variant === "stats" ? ({ "--cols": Math.min(d.items.length, 4) } as React.CSSProperties) : undefined}
            >
              {d.items.map((item, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
                  {d.variant === "steps" && (
                    <span aria-hidden className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange-deep text-sm font-bold text-white">{i + 1}</span>
                  )}
                  {d.variant === "stats" ? (
                    <p className={`${cs ? "text-4xl" : "text-4xl md:text-5xl"} font-bold text-brand-orange-deep dark:text-brand-orange-light`}>{item.title}</p>
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
            {below && d.intro && <p className="mt-4 text-sm md:text-base text-muted">{d.intro}</p>}
          </div>
        </section>
      );
    }

    case "testimonials": {
      const items = rendered.testimonials ?? [];
      if (items.length === 0) return null;
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={block.data.heading ? hid : undefined}>
          <div className={wide("max-w-6xl mx-auto")}>
            <SectionHeading id={hid} heading={block.data.heading} left={cs} />
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
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={block.data.heading ? hid : undefined}>
          <div className={frame("max-w-3xl mx-auto")}>
            <SectionHeading id={hid} heading={block.data.heading} left={cs} />
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
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={block.data.heading ? hid : undefined}>
          <div className={wide("max-w-6xl mx-auto")}>
            <SectionHeading id={hid} heading={block.data.heading} intro={block.data.intro} left={cs} />
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
        <section className={`px-4 sm:px-6 lg:px-8 ${cs ? sec : "py-10"}`} aria-labelledby={d.heading ? hid : undefined}>
          <div className={wide("max-w-6xl mx-auto")}>
            <SectionHeading id={hid} heading={d.heading} left={cs} />
            <ul className={`flex flex-wrap items-center gap-4 ${cs ? "" : "justify-center"}`}>
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
        // A contained card inside the content frame (no full-bleed band): the headline value on the left, an inset
        // card with the label, from → to and caption on the right. Stacks on mobile. Empty parts simply don't render.
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={hid}>
          <div className={`${frame("max-w-4xl mx-auto")} grid gap-5 md:grid-cols-2 md:items-center rounded-2xl bg-tint p-5 md:p-7`}>
            <div>
              {d.eyebrow && <p className="mb-2 text-xs md:text-sm font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light">{d.eyebrow}</p>}
              <p className="font-heading text-5xl md:text-6xl font-bold leading-none tracking-tight text-brand-orange-deep dark:text-brand-orange-light">{d.value}</p>
            </div>
            <div className="rounded-xl bg-background p-4 md:p-5">
              <p id={hid} className="text-[15px] md:text-base font-semibold text-foreground">{d.label}</p>
              {d.from && d.to && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
                  <span>{d.from}</span>
                  <span aria-label="to" className="text-brand-orange-deep dark:text-brand-orange-light">&rarr;</span>
                  <span className="font-heading text-xl md:text-2xl font-bold text-foreground">{d.to}</span>
                </p>
              )}
              {d.caption && <p className="mt-2 text-sm text-muted">{d.caption}</p>}
            </div>
          </div>
        </section>
      );
    }

    case "factsStrip": {
      const items = block.data.items;
      if (items.length === 0) return null;
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${cs ? sec : "py-8"}`}>
          <dl
            className={`${wide("max-w-6xl mx-auto")} grid gap-px overflow-hidden rounded-2xl border border-border bg-border ${cs ? "grid-cols-2 md:[grid-template-columns:repeat(var(--cols-md),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"}`}
            style={cs ? ({ "--cols": Math.min(items.length, 6), "--cols-md": Math.min(items.length, 3) } as React.CSSProperties) : undefined}
          >
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
      // The emphasized column gets a solid tint plus a left rule so it stays visible in both themes.
      const emphasis = (c: number) => (d.highlightLastColumn && c === last && last > 0 ? "bg-brand-orange/15 border-l-2 border-brand-orange font-bold text-brand-orange-deep dark:text-brand-orange-light" : "");
      return (
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={d.heading ? hid : undefined}>
          <div className={frame("max-w-4xl mx-auto")}>
            <SectionHeading id={hid} heading={d.heading} intro={d.intro} left={cs} />
            <div className="overflow-x-auto rounded-2xl border border-border bg-card" tabIndex={0} role="region" aria-label={d.heading || "Data table"}>
              <table className="w-full min-w-[28rem] text-left text-base md:text-lg">
                <thead>
                  <tr className="border-b border-border bg-tint">
                    {d.columns.map((c, i) => (
                      <th key={i} scope="col" className={`px-4 md:px-5 py-3.5 text-sm md:text-base font-bold uppercase tracking-wide text-foreground ${emphasis(i)}`}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {d.rows.map((row, r) => (
                    <tr key={r}>
                      {d.columns.map((_, c) =>
                        c === 0 ? (
                          <th key={c} scope="row" className="px-4 md:px-5 py-4 font-semibold text-foreground">{row[c]}</th>
                        ) : (
                          <td key={c} className={`px-4 md:px-5 py-4 text-foreground ${emphasis(c)}`}>{row[c]}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {d.footnote && <p className="mt-3 text-sm md:text-base text-muted">{d.footnote}</p>}
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
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`} aria-labelledby={d.heading ? hid : undefined}>
          <div className={cs ? (d.columns === 1 ? frame("") : wide("")) : `mx-auto ${d.columns === 1 ? "max-w-3xl" : "max-w-6xl"}`}>
            <SectionHeading id={hid} heading={d.heading} intro={d.intro} left={cs} />
            <ul className={`grid gap-6 ${cols}`}>
              {items.map((item, i) => (
                <li key={i}>
                  <figure className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="relative">
                      <Img src={item.imageUrl} alt={item.imageAlt || item.caption} className="w-full" />
                      {item.badge && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">{item.badge}</span>}
                    </div>
                    {item.caption && <figcaption className="p-4 text-base font-medium text-foreground">{item.caption}</figcaption>}
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
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`}>
          <figure className={`${frame("max-w-3xl mx-auto")} rounded-2xl border-l-4 border-brand-orange bg-card p-6 md:p-10`}>
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
        <section className={`px-4 sm:px-6 lg:px-8 ${sec}`}>
          <div className={`${frame("max-w-4xl mx-auto")} rounded-3xl bg-brand-orange-deep p-8 md:p-12 text-white`}>
            {d.label && <p className="text-sm font-semibold uppercase tracking-wider text-white/80">{d.label}</p>}
            <p className="mt-3 text-2xl md:text-4xl font-bold leading-snug">{d.text}</p>
          </div>
        </section>
      );
    }

    case "leadForm": {
      const d = block.data;
      return (
        <section className={`px-4 sm:px-6 lg:px-8 bg-tint ${cs ? tint : "py-16"}`}>
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
export default function BlockRenderer({ blocks, pageTitle, source, layout = "default" }: { blocks: RenderedBlock[]; pageTitle?: string; source: string; layout?: BlockLayout }) {
  const firstHero = blocks.findIndex((b) => b.block.type === "hero");
  // One FAQPage object for the whole page, however many FAQ blocks it has (duplicate FAQPage markup is invalid).
  const faqEntries = blocks.flatMap((b) => (b.block.type === "faq" ? b.faqs ?? [] : []));
  const cs = layout === "caseStudy";
  // richText that is only a short lead-in paragraph, directly before a block that has no heading of its own.
  const leads = blocks.map((b, i) => {
    const next = blocks[i + 1]?.block;
    return cs && b.block.type === "richText" && !b.block.data.eyebrow && isFootnoteHtml(sanitizeRichText(b.block.data.html), 400)
      && (next?.type === "proofGallery" || next?.type === "dataTable" || next?.type === "cards") && !next.data.heading;
  });
  return (
    <>
      {faqEntries.length > 0 && <JsonLd schema={faqPageSchema(faqEntries)} />}
      {pageTitle && firstHero === -1 && (
        <h1 className="px-4 pt-8 text-3xl md:text-5xl font-bold text-foreground leading-tight text-center">{pageTitle}</h1>
      )}
      {blocks.map((rendered, i) => (
        <BlockView key={`${rendered.block.id}-${i}`} rendered={rendered} h1={i === firstHero && Boolean(pageTitle)} source={source} underNav={i === 0 && Boolean(pageTitle)} cs={cs} isLast={i === blocks.length - 1} leadsNext={leads[i]} afterLead={i > 0 && leads[i - 1]} />
      ))}
    </>
  );
}
