"use client";

import { useEffect, useRef } from "react";

/**
 * 3px accent bar at the very top of the viewport (above the sticky site
 * header). It fills as the reader moves through the element with `targetId`.
 * Updates the DOM directly, so scrolling never re-renders React. Under
 * prefers-reduced-motion there is no easing, the bar just tracks the scroll.
 */
export default function ReadingProgress({ targetId, label }: { targetId: string; label: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const total = rect.height;
      // 100% once the end of the article has scrolled to 40% of the viewport height.
      const done = window.innerHeight * 0.4 - rect.top;
      const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
      if (bar.current) {
        bar.current.style.transform = `scaleX(${ratio})`;
        bar.current.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[3px]">
      <div
        ref={bar}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="h-full origin-left bg-gradient-to-r from-brand-orange-deep to-brand-orange rtl:origin-right motion-safe:transition-transform motion-safe:duration-100"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
