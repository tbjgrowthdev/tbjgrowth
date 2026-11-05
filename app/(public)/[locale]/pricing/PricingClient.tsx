"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STAGE_LABELS, type PublicPackage, type PublicPricing } from "@/lib/pricing/public";
import "./pricing.css";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function CtaLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (/^https?:\/\//.test(href)) return <a href={href} className={className} rel="noopener noreferrer">{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}

const ctaHref = (p: PublicPackage) => p.ctaLink || "/contact";
const ctaLabel = (p: PublicPackage) => p.ctaLabel || `Get started with ${p.name}`;

function Decorations({ children }: { children?: React.ReactNode }) {
  return <div aria-hidden="true" className="px-deco" style={{ inset: 0, overflow: "hidden" }}>{children}</div>;
}

export default function PricingClient({ data }: { data: PublicPricing }) {
  const { texts, packages, comparisonRows, policies, footnotes } = data;
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = useCallback((i: number, focus = false) => {
    setSelected(i);
    const slug = packages[i]?.slug;
    if (slug && typeof window !== "undefined") window.history.replaceState(null, "", `#${slug}`);
    if (focus) tabRefs.current[i]?.focus();
  }, [packages]);

  // Deep link: /pricing#growth selects that package (no reload on switching).
  useEffect(() => {
    const apply = () => {
      const slug = window.location.hash.replace(/^#/, "");
      const i = packages.findIndex((p) => p.slug === slug);
      if (i >= 0) setSelected(i);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [packages]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = packages.length;
    let next = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (selected + 1) % n;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (selected - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next >= 0) { e.preventDefault(); select(next, true); }
  };

  const hasHeader = texts.eyebrow || texts.headline || texts.intro;
  const countWord = NUMBER_WORDS[packages.length] ?? String(packages.length);

  if (!data.hasContent) {
    return (
      <main className="px-root">
        <Decorations><div className="px-deco px-dots" /><div className="px-deco px-glow px-glow-1" /><div className="px-deco px-glow px-glow-2" /></Decorations>
        <div className="px-wrap">
          {hasHeader && (
            <header className="px-head">
              {texts.eyebrow && <span className="px-eyebrow">{texts.eyebrow}</span>}
              {texts.headline && <h1 className="px-title px-h1">{texts.headline}</h1>}
              {texts.intro && <p className="px-lead">{texts.intro}</p>}
            </header>
          )}
          <div className="px-empty px-glass" role="status">
            <h1 className="px-panel-title" style={{ marginTop: 0 }}>Pricing is being updated</h1>
            <p>Our packages aren&apos;t published here just yet. Get in touch and we&apos;ll talk you through the options.</p>
            <Link href="/contact" className="px-btn px-btn-primary">Contact us <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </main>
    );
  }

  const pkg = packages[Math.min(selected, packages.length - 1)];
  const stageCount = pkg.stages.length;
  const showSetupRow = packages.some((p) => p.prices.some((x) => x.setup));
  const showCapRow = packages.some((p) => p.prices.some((x) => x.adCap));

  return (
    <main className="px-root">
      {/* Section 1: funnel explorer */}
      <section className="px-section" aria-labelledby="px-heading">
        <Decorations>
          <div className="px-deco px-dots" />
          <div className="px-deco px-glow px-glow-1" />
          <div className="px-deco px-glow px-glow-2" />
        </Decorations>
        <div className="px-wrap">
          <header className="px-head">
            {texts.eyebrow && <span className="px-eyebrow">{texts.eyebrow}</span>}
            {texts.headline ? <h1 id="px-heading" className="px-title px-h1">{texts.headline}</h1> : <h1 id="px-heading" className="sr-only">Pricing</h1>}
            {texts.intro && <p className="px-lead">{texts.intro}</p>}
          </header>

          <div className="px-explorer">
            <div className="px-left">
              <div role="tablist" aria-label="Packages" aria-orientation="vertical" className="px-tablist" onKeyDown={onKeyDown}>
                {packages.map((p, i) => (
                  <button
                    key={p.slug}
                    ref={(el) => { tabRefs.current[i] = el; }}
                    role="tab"
                    id={`px-tab-${p.slug}`}
                    aria-selected={i === selected}
                    aria-controls="px-panel"
                    tabIndex={i === selected ? 0 : -1}
                    type="button"
                    onClick={() => select(i)}
                    className={`px-tab ${i === selected ? "" : "px-glass"}`}
                  >
                    <span className="px-tab-top">
                      <span className="px-tab-name">{p.name}</span>
                      {p.isMostPopular && <span className="px-badge">Most popular</span>}
                    </span>
                    {p.tagline && <span className="px-tab-tag" style={{ display: "block" }}>{p.tagline}</span>}
                    <span className="px-tab-prices">
                      {p.prices.map((pr) => (
                        <span key={pr.code} className="px-tab-price">{pr.monthly}<small>/mo</small></span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              {texts.upfrontOffer && <div className="px-upfront">{texts.upfrontOffer}</div>}
            </div>

            <div className="px-right">
              <div id="px-panel" role="tabpanel" aria-labelledby={`px-tab-${pkg.slug}`} tabIndex={0} className="px-panel px-glass">
                <div className="px-panel-kicker">{pkg.number}</div>
                <h2 className="px-panel-title">{pkg.name}{pkg.tagline ? ` · ${pkg.tagline}` : ""}</h2>
                {pkg.description && <p className="px-panel-desc">{pkg.description}</p>}

                <div className="px-sec">
                  <div className="px-label">Funnel coverage</div>
                  <ul className="px-chips" style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
                    {STAGE_LABELS.slice(0, stageCount).map((label, i) => (
                      <li key={label} className={`px-chip ${pkg.stages[i] ? "px-chip-on" : "px-chip-off"}`}>
                        {label}<span className="sr-only">{pkg.stages[i] ? " (covered)" : " (not covered)"}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="px-prices">
                  {pkg.prices.map((pr) => (
                    <div key={pr.code} className="px-pricecard px-inset">
                      <div className="px-pricecard-label">{pr.label}</div>
                      <div className="px-pricecard-amount">{pr.monthly}<small>/month</small></div>
                      {pr.setup && <div className="px-pricecard-line">+ {pr.setup} one-time setup</div>}
                      {pr.adCap && <div className="px-pricecard-line">Ads managed up to {pr.adCap}</div>}
                    </div>
                  ))}
                </div>

                {pkg.features.length > 0 && (
                  <div className="px-sec">
                    <div className="px-label">What&apos;s included</div>
                    <ul className="px-features">
                      {pkg.features.map((f) => (
                        <li key={f.label} className="px-feature">
                          <span className="px-feature-label">{f.label}</span>
                          <span className="px-feature-text">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(pkg.notIncluded || pkg.moveUpText) && (
                  <div className="px-boxes">
                    {pkg.notIncluded && <div className="px-box px-inset"><strong>Not included</strong>{pkg.notIncluded}</div>}
                    {pkg.moveUpText && <div className="px-box px-inset"><strong>{pkg.moveUpTitle || "Move up"}</strong>{pkg.moveUpText}</div>}
                  </div>
                )}

                <div className="px-cta-row">
                  <CtaLink href={ctaHref(pkg)} className="px-btn px-btn-primary">{ctaLabel(pkg)} <ArrowRight size={16} aria-hidden="true" /></CtaLink>
                  {texts.contractLine && <span className="px-contract">{texts.contractLine}</span>}
                </div>
              </div>
              {packages.length > 1 && (
                <a href="#compare" className="px-link">Compare all {countWord} packages side by side</a>
              )}
            </div>
          </div>
        </div>
        <div className="px-divider" aria-hidden="true" />
      </section>

      {/* Section 2: comparison */}
      <section id="compare" className="px-section px-compare" aria-labelledby="px-compare-title" style={{ scrollMarginTop: 72 }}>
        <Decorations>
          <div className="px-deco px-glow px-glow-3" />
          <div className="px-deco px-glow px-glow-4" />
        </Decorations>
        <div className="px-wrap">
          <span className="px-eyebrow">Overview</span>
          <h2 id="px-compare-title" className="px-title px-h2">{texts.compareTitle || "Compare packages"}</h2>
          {texts.compareSubtitle && <p className="px-lead">{texts.compareSubtitle}</p>}

          <div className="px-table-card px-glass">
            <table className="px-table">
              <caption className="sr-only">Package comparison</caption>
              <colgroup>
                <col className="px-col-label" />
                {packages.map((p) => <col key={p.slug} />)}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Details</span></th>
                  {packages.map((p) => (
                    <th key={p.slug} scope="col" className={p.isMostPopular ? "px-pop" : undefined}>
                      <div className="px-th-name">{p.name}</div>
                      {p.tagline && <div className="px-th-tag">{p.tagline}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Monthly</th>
                  {packages.map((p) => (
                    <td key={p.slug} className={p.isMostPopular ? "px-pop" : undefined}>
                      {p.prices.length ? p.prices.map((pr) => (
                        <div key={pr.code} className="px-cell-money"><span className="px-cell-code">{pr.code}</span>{pr.monthly}<small>/mo</small></div>
                      )) : <span className="px-dash">—</span>}
                    </td>
                  ))}
                </tr>
                {showSetupRow && (
                  <tr>
                    <th scope="row">One-time setup</th>
                    {packages.map((p) => (
                      <td key={p.slug} className={p.isMostPopular ? "px-pop" : undefined}>
                        {p.prices.some((x) => x.setup) ? p.prices.filter((x) => x.setup).map((pr) => (
                          <div key={pr.code} className="px-cell-line"><span className="px-cell-code">{pr.code}</span>{pr.setup}</div>
                        )) : <span className="px-dash">—</span>}
                      </td>
                    ))}
                  </tr>
                )}
                {comparisonRows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {packages.map((p) => (
                      <td key={p.slug} className={p.isMostPopular ? "px-pop" : undefined}>{r.cells[p.slug] ?? <span className="px-dash">—</span>}</td>
                    ))}
                  </tr>
                ))}
                {showCapRow && (
                  <tr>
                    <th scope="row">Ad spend managed</th>
                    {packages.map((p) => (
                      <td key={p.slug} className={p.isMostPopular ? "px-pop" : undefined}>
                        {p.prices.some((x) => x.adCap) ? p.prices.filter((x) => x.adCap).map((pr) => (
                          <div key={pr.code} className="px-cell-line"><span className="px-cell-code">{pr.code}</span>{pr.adCap}</div>
                        )) : <span className="px-dash">—</span>}
                      </td>
                    ))}
                  </tr>
                )}
                <tr>
                  <th scope="row"><span className="sr-only">Choose a package</span></th>
                  {packages.map((p) => (
                    <td key={p.slug} className={p.isMostPopular ? "px-pop" : undefined}>
                      <CtaLink href={ctaHref(p)} className={`px-btn ${p.isMostPopular ? "px-btn-primary" : "px-btn-secondary"}`}>Choose {p.name}</CtaLink>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {policies.length > 0 && (
            <div className="px-policies">
              {policies.map((pol) => (
                <div key={pol.key} className="px-policy px-glass">
                  <h3>{pol.title}</h3>
                  {pol.entries.map((e, i) => (
                    <p key={i}>{e.code && <b>{e.code}:</b>}{e.text}</p>
                  ))}
                </div>
              ))}
            </div>
          )}

          {footnotes.length > 0 && (
            <div className="px-footnotes">
              {footnotes.map((f) => <p key={f}>{f}</p>)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
