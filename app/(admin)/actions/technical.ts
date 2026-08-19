"use server";

import prisma from "@/lib/prisma";
import tls from "tls";

const THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function rate(metric: string, value: number) {
  const t = THRESHOLDS[metric];
  if (!t) return "unknown";
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

/** p75 (Google's official Core Web Vitals threshold basis) per metric over the last 7 days of real visitor samples. */
export async function getWebVitalsSummary() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const samples = await prisma.webVitalSample.findMany({
      where: { createdAt: { gte: since } },
      select: { metric: true, value: true },
    });

    const byMetric: Record<string, number[]> = {};
    for (const s of samples) {
      (byMetric[s.metric] ||= []).push(s.value);
    }

    const summary = Object.entries(byMetric).map(([metric, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const p75 = percentile(sorted, 75)!;
      return { metric, p75, rating: rate(metric, p75), sampleCount: values.length };
    });

    return { totalSamples: samples.length, metrics: summary };
  } catch (error) {
    console.error("Failed to compute web vitals summary:", error);
    return { totalSamples: 0, metrics: [] };
  }
}

/** Recent failed login attempts — a lightweight security-visibility signal. */
export async function getRecentFailedLogins(hours = 24) {
  try {
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
