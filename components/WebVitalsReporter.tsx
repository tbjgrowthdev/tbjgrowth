"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function WebVitalsReporter() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Metrics (LCP/CLS/etc) are measured once per hard page load, so the web-vitals
  // listeners are registered only on mount — not re-subscribed on every client-side
  // route change, which would double-report and misattribute in-flight metrics.
  useEffect(() => {
    let cancelled = false;

    import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
      if (cancelled) return;

      const report = (metric: { name: string; value: number; rating: string }) => {
        const body = JSON.stringify({
          path: pathRef.current,
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/web-vitals", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/web-vitals", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
        }
      };

      onLCP(report);
      onCLS(report);
      onINP(report);
      onFCP(report);
      onTTFB(report);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
