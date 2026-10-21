import { getGoogleIntegration } from "@/lib/google-oauth";
import type { IntegrationStatusView } from "./types";

const AI_PROVIDER_LABEL: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", gemini: "Gemini" };
const AI_PROVIDER_KEY_ENV: Record<string, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" };

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
 * Mirrors lib/content-pipeline/providers' env-var selection: only the
 * provider AI_PROVIDER actually points at is reported as live (or in
 * Error, if it's selected but missing its key — that combination will
 * throw the moment any pipeline stage actually calls it, so Error is the
 * honest status, not Disconnected). The other two configured-or-not
 * providers show Disconnected regardless of whether their key happens to
 * be set, since nothing calls them while they're not the active one.
 */
export function getAiProviderMirrorStatus(): IntegrationStatusView {
  const active = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const activeLabel = AI_PROVIDER_LABEL[active] || active;
  const hasKey = !!process.env[AI_PROVIDER_KEY_ENV[active] || "ANTHROPIC_API_KEY"];

  return view({
    id: "AI_PROVIDERS",
    label: "AI Providers",
    category: "Content",
    status: hasKey ? "CONNECTED" : "ERROR",
    lastError: hasKey ? null : `AI_PROVIDER is set to "${active}" but ${AI_PROVIDER_KEY_ENV[active] || `${active.toUpperCase()}_API_KEY`} is not configured`,
    lastCheckedAt: null,
    connectedAt: null,
    metadataSummary: `Active: ${activeLabel}`,
    managedBy: "env",
    manageHref: null,
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
