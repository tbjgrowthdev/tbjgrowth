import { createHmac } from "crypto";
import type { TestResult } from "../types";

/** Sends a real test event to the configured URL — a 2xx response is the only honest signal that something is actually listening there. */
export async function testWebhookConnection(credentials: Record<string, string>): Promise<TestResult> {
  const url = credentials.url?.trim();
  const secret = credentials.secret?.trim();
  if (!url) return { ok: false, error: "Webhook URL is required" };

  const payload = JSON.stringify({ event: "integration.test", sentAt: new Date().toISOString() });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Webhook-Signature"] = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const res = await fetch(url, { method: "POST", headers, body: payload });
    if (!res.ok) return { ok: false, error: `Endpoint responded with HTTP ${res.status}` };
    return { ok: true, metadata: { url } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach this URL" };
  }
}

/** Sends a real event payload to the configured webhook — used by the automation engine's NOTIFY_TEAM action, not just the connection test above. Throws on a non-2xx/network failure so the caller can record it as a failed step. */
export async function sendWebhookEvent(url: string, secret: string | undefined, payload: Record<string, unknown>): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Webhook-Signature"] = createHmac("sha256", secret).update(body).digest("hex");

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`Webhook endpoint responded with HTTP ${res.status}`);
}
