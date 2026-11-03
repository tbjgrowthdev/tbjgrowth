"use client";

import { useEffect, useState } from "react";
import type { ArticleHeading } from "@/lib/blog-content";

/**
 * "On this page" list. Highlights the section being read (IntersectionObserver)
 * and scrolls smoothly on click, unless the visitor prefers reduced motion.
 * The caller hides it when there are fewer than two headings.
 */
export default function TableOfContents({
  headings,
  title,
  label,
}: {
  headings: ArticleHeading[];
  title: string;
  label: string;
}) {
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) return;
    const inView = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inView.add(e.target.id);
          else inView.delete(e.target.id);
        }
        // First heading (document order) inside the reading band. If none is
        // inside it, keep the last one.
        const first = els.find((el) => inView.has(el.id));
        if (first) setActive(first.id);
      },
      // The band starts under the sticky header and covers the top ~30% of the viewport.
      { rootMargin: "-96px 0px -70% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <nav aria-label={label} className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
      <ol className="space-y-1">
        {headings.map((h) => {
          const isActive = h.id === active;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={(e) => go(e, h.id)}
                aria-current={isActive ? "location" : undefined}
                className={`block border-s-2 py-1.5 text-sm leading-snug transition-colors ${h.level === 3 ? "ps-6" : "ps-3"} ${
                  isActive
                    ? "border-brand-orange font-semibold text-brand-orange-deep dark:text-brand-orange-light"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
