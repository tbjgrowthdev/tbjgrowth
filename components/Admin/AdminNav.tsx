"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeftClose, Search } from "lucide-react";

/** One sidebar link. Active state comes from the URL, so the nav itself can stay a server component. */
export function NavItem({ href, icon, children, sub = false }: { href: string; icon: ReactNode; children: string; sub?: boolean }) {
  const pathname = usePathname() || "";
  const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className="admin-nav-item"
      aria-current={active ? "page" : undefined}
      data-sub={sub ? "" : undefined}
      // Collapsed rail hides the label; the native tooltip keeps the destination discoverable.
      title={children}
    >
      <span className="admin-nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="admin-nav-label truncate">{children}</span>
    </Link>
  );
}

const SB_KEY = "tbj-admin-sidebar";

/** Desktop collapse/expand. The state lives on <html data-sb> (set pre-paint by the layout script) to avoid layout shift. */
export function SidebarCollapseButton() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sb === "collapsed");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.dataset.sb = "collapsed";
    else delete document.documentElement.dataset.sb;
    try {
      localStorage.setItem(SB_KEY, next ? "collapsed" : "expanded");
    } catch {
      /* storage blocked: the toggle still works for this page view */
    }
  };

  return (
    <button type="button" onClick={toggle} className="admin-nav-item hidden md:flex" aria-pressed={collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
      <span className="admin-nav-icon admin-collapse-icon" aria-hidden="true">
        <PanelLeftClose size={18} />
      </span>
      <span className="admin-nav-label">Collapse</span>
    </button>
  );
}

/** Pill search in the top bar. Enter opens the existing Advanced Search screen with the query; Ctrl/Cmd+K focuses it. */
export function TopSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="admin-search w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim();
        router.push(q ? `/admin/search?q=${encodeURIComponent(q)}` : "/admin/search");
      }}
    >
      <Search size={16} aria-hidden="true" className="flex-none" />
      <input ref={ref} type="search" name="q" aria-label="Search posts, pages, case studies and services" placeholder="Search content..." autoComplete="off" />
      <kbd className="kbd hidden sm:inline" aria-hidden="true">
        Ctrl K
      </kbd>
    </form>
  );
}
