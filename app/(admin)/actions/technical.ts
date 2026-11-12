"use server";

import prisma from "@/lib/prisma";
import tls from "tls";
import { requirePermission } from "@/lib/auth-guard";
import { WEB_VITAL_METRICS, rateWebVital } from "@/lib/web-vitals";

/**
 * p75 (Google's official Core Web Vitals threshold basis) per metric over the
 * last 7 days of real visitor samples. Computed in Postgres, so only five
 * rows come back instead of every sample in the window.
 */
export async function getWebVitalsSummary() {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const rows = await prisma.$queryRaw<{ metric: string; p75: number; count: bigint }[]>`
      SELECT "metric",
             percentile_disc(0.75) WITHIN GROUP (ORDER BY "value") AS "p75",
             COUNT(*) AS "count"
      FROM "WebVitalSample"
      WHERE "createdAt" >= ${since}
      GROUP BY "metric"
    `;

    const summary = WEB_VITAL_METRICS.flatMap((metric) => {
      const row = rows.find((r) => r.metric === metric);
      if (!row) return [];
      const p75 = Number(row.p75);
      return [{ metric, p75, rating: rateWebVital(metric, p75), sampleCount: Number(row.count) }];
    });

    return { totalSamples: summary.reduce((sum, m) => sum + m.sampleCount, 0), metrics: summary };
  } catch (error) {
    console.error("Failed to compute web vitals summary:", error);
    return { totalSamples: 0, metrics: [] };
  }
}

/** Recent failed login attempts — a lightweight security-visibility signal. */
export async function getRecentFailedLogins(hours = 24) {
  try {
    await requirePermission("SETTINGS_MANAGEMENT");
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return await prisma.loginAttempt.findMany({
      where: { success: false, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch (error) {
    console.error("Failed to fetch login attempts:", error);
    return [];
  }
}

/** Live check of the site's own TLS certificate expiry (connects to its own hostname on port 443). */
export async function checkTlsCertificate(): Promise<{ valid: boolean; expiresAt: string | null; daysRemaining: number | null; error?: string }> {
  await requirePermission("SETTINGS_MANAGEMENT");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    return { valid: false, expiresAt: null, daysRemaining: null, error: "Invalid base URL configured" };
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { valid: false, expiresAt: null, daysRemaining: null, error: "Running locally — no public TLS certificate to check" };
  }

  // Cloudflare Workers can't open a raw TCP/TLS socket to a Cloudflare-proxied
  // hostname (including this site's own domain) — tls.connect() fails with
  // "proxy request failed, cannot connect to the specified address". The
  // certificate visitors see is Cloudflare's edge certificate, which Cloudflare
  // issues and renews automatically, so there's nothing for this check to read.
  if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
    return {
      valid: false,
      expiresAt: null,
      daysRemaining: null,
      error: "SSL is managed by Cloudflare and renews automatically — expiry can't be read from inside the Worker. View it in the Cloudflare dashboard under SSL/TLS → Edge Certificates.",
    };
  }

  return new Promise((resolve) => {
    const socket = tls.connect(443, hostname, { servername: hostname, timeout: 5000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) {
        resolve({ valid: false, expiresAt: null, daysRemaining: null, error: "Could not read certificate" });
        return;
      }
      const expiresAt = new Date(cert.valid_to);
      const daysRemaining = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      resolve({ valid: socket.authorized, expiresAt: expiresAt.toISOString(), daysRemaining });
    });

    socket.on("error", (err) => {
      resolve({ valid: false, expiresAt: null, daysRemaining: null, error: err.message });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false, expiresAt: null, daysRemaining: null, error: "Connection timed out" });
    });
  });
}
