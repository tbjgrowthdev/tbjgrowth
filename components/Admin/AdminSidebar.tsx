"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

// Mobile drawer behaviour for the admin sidebar. The nav itself stays a
// server component (permission checks in app/(admin)/layout.tsx); these
// pieces only add open/close state around it. From the md breakpoint up the
// sidebar is always shown, exactly as before.

const SidebarContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({ open: false, setOpen: () => {} });

export function AdminSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function SidebarFrame({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useContext(SidebarContext);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-[#151110]/60 md:hidden" aria-hidden="true" onClick={() => setOpen(false)} />}
      <aside
        id="admin-sidebar"
        // Following any nav link closes the drawer on mobile.
        onClickCapture={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`admin-sidebar fixed inset-y-0 left-0 z-40 max-w-[85vw] flex-shrink-0 flex flex-col h-full transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-4 right-3 z-10 w-9 h-9 inline-flex items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-tint"
        >
          <X size={20} />
        </button>
        {children}
      </aside>
    </>
  );
}

export function SidebarToggle() {
  const { open, setOpen } = useContext(SidebarContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label="Open menu"
      aria-controls="admin-sidebar"
      aria-expanded={open}
      className="icon-btn admin-menu-btn md:hidden"
    >
      <Menu size={18} />
    </button>
  );
}
