"use client";

import { useEffect } from "react";

// Only catches errors that escape every nested error.tsx boundary — a crash
// here replaces the entire document, so (per Next's requirement) it renders
// its own <html>/<body> rather than relying on the root layout. Reports to
// /api/internal/client-error so client-side crashes land in the same
// Monitoring log as server-side ones (see lib/error-monitor.ts).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    fetch("/api/internal/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message,
        stack: error?.stack,
        digest: error?.digest,
        path: typeof window !== "undefined" ? window.location.pathname : null,
      }),
    }).catch(() => {
      // Nothing useful to do if even the error report fails to send.
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif", textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "#666" }}>This has been reported. Please try reloading the page.</p>
          </div>
        </div>
      </body>
    </html>
  );
}
