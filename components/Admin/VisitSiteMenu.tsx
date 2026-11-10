"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { DEFAULT_LOCALE, LOCALES, withLocalePrefix } from "@/lib/i18n";

const homeHref = (prefix: string | null) => withLocalePrefix(prefix, "/");

/**
 * "Visit site" for the admin header: the main button opens the default
 * locale's home page in a new tab, and the chevron lists every market's
 * localized home page, built from the same LOCALES registry the public
 * site's routing uses. Plain <a> links (not next/link): the public site is
 * a separate layout tree, and these open in a new tab anyway.
 */
export default function VisitSiteMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-stretch rounded-full shadow-sm">
      <a
        href={homeHref(DEFAULT_LOCALE.prefix)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the public website in a new tab"
        className="flex items-center gap-2 h-11 pl-4 pr-3 rounded-l-full bg-[var(--admin-primary)] text-sm font-bold text-white hover:bg-[var(--admin-primary-hover)] transition-colors"
      >
        <ExternalLink size={16} />
        <span className="hidden sm:inline">Visit site</span>
        <span className="sr-only sm:hidden">Visit site</span>
      </a>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Choose which localized site to open"
        className="flex items-center h-11 pl-2 pr-3 rounded-r-full border-l border-white/30 bg-[var(--admin-primary)] text-white hover:bg-[var(--admin-primary-hover)] transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl py-2 z-50" style={{ boxShadow: "var(--admin-shadow-pop)" }}>
          <p className="eyebrow px-4 py-1.5">Open home page (new tab)</p>
          {LOCALES.map((locale) => (
            <a
              key={locale.code}
              role="menuitem"
              href={homeHref(locale.prefix)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 mx-2 px-3 py-2 rounded-xl text-sm font-semibold text-foreground hover:bg-tint"
            >
              <span dir={locale.dir}>{locale.label}</span>
              <span className="text-xs text-caption font-mono">{homeHref(locale.prefix)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
