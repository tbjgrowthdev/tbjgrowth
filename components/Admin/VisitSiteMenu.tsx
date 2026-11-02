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
    <div ref={ref} className="relative flex items-stretch">
      <a
        href={homeHref(DEFAULT_LOCALE.prefix)}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the public website in a new tab"
        className="flex items-center gap-2 h-9 pl-3 pr-2 sm:pr-3 rounded-l-lg border border-border text-sm font-medium text-foreground hover:bg-tint hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-colors"
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
        className="flex items-center h-9 px-1.5 rounded-r-lg border border-l-0 border-border text-caption hover:text-foreground hover:bg-tint transition-colors"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-lg shadow-lg py-1 z-50">
          <p className="px-3 py-1.5 text-xs text-caption">Open home page (new tab)</p>
          {LOCALES.map((locale) => (
            <a
              key={locale.code}
              role="menuitem"
              href={homeHref(locale.prefix)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-foreground hover:bg-tint"
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
