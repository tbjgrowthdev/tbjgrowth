"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

const TABS = [
  { href: "/admin/pricing", label: "Packages", exact: true },
  { href: "/admin/pricing/matrix", label: "Price matrix" },
  { href: "/admin/pricing/comparison", label: "Comparison rows" },
  { href: "/admin/pricing/policies", label: "Policies" },
  { href: "/admin/pricing/settings", label: "Texts" },
  { href: "/admin/pricing/currencies", label: "Currencies" },
  { href: "/admin/pricing/import", label: "Import / Export" },
];

export default function PricingTabs() {
  const pathname = usePathname();
  const isActive = (t: (typeof TABS)[number]) => (t.exact ? pathname === t.href || pathname.startsWith("/admin/pricing/packages") : pathname.startsWith(t.href));
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 mb-6">
      <nav aria-label="Pricing sections" className="flex flex-wrap gap-1 flex-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={isActive(t) ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(t) ? "bg-tint text-brand-orange-deep dark:text-brand-orange-light" : "text-muted hover:bg-tint"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Link href="/pricing" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-sm text-brand-orange-deep dark:text-brand-orange-light hover:underline">
        Preview public page <ExternalLink size={14} />
      </Link>
    </div>
  );
}
