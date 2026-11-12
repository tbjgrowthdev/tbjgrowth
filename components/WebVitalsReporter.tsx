"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { WEB_VITALS_SAMPLE_RATE, isWebVitalMetric, type WebVitalMetric } from "@/lib/web-vitals";

/**
 * Reports Core Web Vitals for a sample of page loads (WEB_VITALS_SAMPLE_RATE).
 * All metrics for a page load go in one request, sent when the page is
 * hidden (tab switch, navigation away, close). That is also when web-vitals
 * finalizes LCP, CLS and INP, so nothing is lost by waiting.
 */
export default function WebVitalsReporter() {
  // The metrics describe the hard page load, so they're attributed to the
  // page that was loaded, not wherever client-side navigation has got to by
  // the time the tab is hidden.
  const landingPathRef = useRef(usePathname());

  // Metrics (LCP/CLS/etc) are measured once per hard page load, so the web-vitals
  // listeners are registered only on mount — not re-subscribed on every client-side
  // route change, which would double-report and misattribute in-flight metrics.
  useEffect(() => {
    // Not sampled: skip loading the web-vitals library entirely.
    if (Math.random() >= WEB_VITALS_SAMPLE_RATE) return;

    let cancelled = false;
    const pending = new Map<WebVitalMetric, number>();
    const sent = new Set<WebVitalMetric>();

    const flush = () => {
      if (pending.size === 0) return;
      const metrics: Partial<Record<WebVitalMetric, number>> = {};
      for (const [name, value] of pending) {
        metrics[name] = value;
        sent.add(name);
      }
      pending.clear();

      const body = JSON.stringify({ path: landingPathRef.current, metrics });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/web-vitals", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/web-vitals", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
      if (cancelled) return;

      // Each metric is sent once per page load. A metric that changes after
      // it was sent (CLS growing after the user comes back to the tab) is
      // not re-sent, so a page load is never counted twice.
      const record = (metric: { name: string; value: number }) => {
        if (!isWebVitalMetric(metric.name) || sent.has(metric.name)) return;
        pending.set(metric.name, metric.value);
      };

      onLCP(record);
      onCLS(record);
      onINP(record);
      onFCP(record);
      onTTFB(record);

      // Bubble-phase listener on window: runs after web-vitals' own capture
      // listeners, which report the final LCP/CLS/INP into `pending` first.
      window.addEventListener("visibilitychange", onVisibilityChange);
      // Older Safari doesn't always fire visibilitychange on unload.
      window.addEventListener("pagehide", flush);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  return null;
}
