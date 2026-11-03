"use client";

import { useEffect, useRef, useState } from "react";

// Matches the site header (top-24 = 96px) plus a little breathing room.
const TOP_OFFSET = 96;
const BOTTOM_GAP = 24;

/**
 * Sticky on desktop only while the whole sidebar fits in the viewport.
 * When it is taller (short laptop screens), it stays in normal flow and scrolls
 * with the page, so it never needs its own scrollbar and nothing is clipped.
 * Static on tablet and phone.
 */
export default function StickySidebar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const measure = () => {
      setSticky(desktop.matches && el.offsetHeight + TOP_OFFSET + BOTTOM_GAP <= window.innerHeight);
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    desktop.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      desktop.removeEventListener("change", measure);
    };
  }, []);

  return (
    <div ref={ref} className={`${className} ${sticky ? "sticky top-24" : ""}`}>
      {children}
    </div>
  );
}
