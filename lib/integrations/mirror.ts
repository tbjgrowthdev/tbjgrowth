import { getGoogleIntegration } from "@/lib/google-oauth";
import { PROVIDER_KEY_ENV, PROVIDER_LABEL, resolveAiConfig } from "@/lib/content-pipeline/providers/config";
import { resolveAiApiKey } from "@/lib/content-pipeline/providers/keys";
import type { IntegrationStatusView } from "./types";

function view(partial: Omit<IntegrationStatusView, "provider" | "liveTestAvailable">): IntegrationStatusView {
  return { ...partial, provider: null, liveTestAvailable: false };
}

/**
 * Google Search Console and Google Analytics share one OAuth grant
 * (GoogleIntegration), so both rows reflect the same connection — there's
 * no separate way to be connected to one but not the other. "Connected"
 * means a grant exists; this never makes a live API call itself (that
 * would mean an extra GSC/GA4 request on every Hub page load), so a
 * revoked-but-not-yet-refreshed grant briefly shows Connected until the
 * next real data fetch discovers otherwise via getValidAccessToken.
 */
export async function getGoogleMirrorStatuses(): Promise<IntegrationStatusView[]> {
  const integration = await getGoogleIntegration();
  const manageHref = "/admin/seo";
  const connectedAt = integration?.createdAt.toISOString() ?? null;
  const metadataSummary = integration?.connectedEmail ? `as ${integration.connectedEmail}` : null;

  const base = {
    status: (integration ? "CONNECTED" : "DISCONNECTED") as "CONNECTED" | "DISCONNECTED",
    lastError: null,
    lastCheckedAt: null,
    connectedAt,
    metadataSummary,
    managedBy: "google-oauth" as const,
    manageHref,
  };

  return [
    view({ id: "GOOGLE_SEARCH_CONSOLE", label: "Google Search Console", category: "Analytics", ...base }),
    view({ id: "GOOGLE_ANALYTICS", label: "Google Analytics", category: "Analytics", ...base }),
  ];
}

/**
 * Mirrors lib/content-pipeline/providers' selection (Settings → AI
 * Provider, else the AI_PROVIDER env var): only the active text provider
 * is reported as live, or as Error if it's selected but has no key (neither
 * one entered in Settings → AI Provider nor its env var) —
 * that combination throws the moment any pipeline stage calls it, so Error
 * is the honest status, not Disconnected.
 */
export async function getAiProviderMirrorStatus(): Promise<IntegrationStatusView> {
  const { text } = await resolveAiConfig();
  const activeLabel = PROVIDER_LABEL[text.provider] || text.provider;
  const { source: keySource } = await resolveAiApiKey(text.provider);
  const hasKey = keySource !== "none";
  const keyEnv = PROVIDER_KEY_ENV[text.provider] || `${text.provider.toUpperCase()}_API_KEY`;
  const selectedVia = text.source === "admin" ? "selected in Settings" : "AI_PROVIDER env var";

  return view({
    id: "AI_PROVIDERS",
    label: "AI Providers",
    category: "Content",
    status: hasKey ? "CONNECTED" : "ERROR",
    lastError: hasKey ? null : `${activeLabel} is the active provider (${selectedVia}) but ${keyEnv} is not configured and no key was entered in Settings → AI Provider`,
    lastCheckedAt: null,
    connectedAt: null,
    metadataSummary: `Active: ${activeLabel}${text.model ? ` (${text.model})` : ""} — ${selectedVia}${hasKey ? ` · key from ${keySource === "admin" ? "Settings" : "env var"}` : ""}`,
    managedBy: "env",
    manageHref: "/admin/settings#ai-provider",
  });
}

/** Mirrors lib/email.ts's own "missing key logs and skips, never throws" fallback. */
export function getEmailMirrorStatus(): IntegrationStatusView {
  const hasKey = !!process.env.RESEND_API_KEY;
  return view({
    id: "EMAIL",
    label: "Email (Resend)",
    category: "Marketing",
    status: hasKey ? "CONNECTED" : "DISCONNECTED",
    lastError: null,
    lastCheckedAt: null,
    connectedAt: null,
    metadataSummary: hasKey ? (process.env.RESEND_FROM_EMAIL || null) : null,
    managedBy: "env",
    manageHref: null,
  });
}
