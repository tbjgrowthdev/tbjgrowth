"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderKanban, FileBarChart, Receipt, Menu } from "lucide-react";
import type { PortalStrings } from "@/lib/portal/strings";

const TABS = [
  { href: "/portal", key: "home", icon: Home, exact: true },
  { href: "/portal/projects", key: "projects", icon: FolderKanban },
  { href: "/portal/reports", key: "reports", icon: FileBarChart },
  { href: "/portal/billing", key: "billing", icon: Receipt },
  { href: "/portal/more", key: "more", icon: Menu },
] as const;

export default function TabBar({ labels }: { labels: PortalStrings["tabs"] }) {
  const pathname = usePathname() || "/portal";
  return (
    <nav className="portal-tabbar" aria-label="Client Hub">
      {TABS.map(({ href, key, icon: Icon, ...rest }) => {
        const exact = "exact" in rest && rest.exact;
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="portal-tab" aria-current={active ? "page" : undefined} prefetch>
            <span className="portal-tab-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            {labels[key]}
          </Link>
        );
      })}
    </nav>
  );
}
