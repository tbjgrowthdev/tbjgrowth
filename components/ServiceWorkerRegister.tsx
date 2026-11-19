"use client";

import { useEffect } from "react";

// Registers public/sw.js (production only, so `next dev` never serves stale
// assets). Mounted from the public layout; the worker itself ignores /admin,
// /login and /api, so admin pages are never cached even though its scope is "/".
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);
  return null;
}
