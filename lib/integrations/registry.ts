import type { ProviderDefinition, ProviderFieldDefinition } from "./types";
import { testGoogleBusinessProfileConnection } from "./providers/google-business-profile";
import { testMetaConnection } from "./providers/meta";
import { testSlackConnection } from "./providers/slack";
import { testWordPressConnection } from "./providers/wordpress";
import { testWebhookConnection } from "./providers/webhooks";

/**
 * Every provider the Integration Hub itself owns credentials for — see
 * the Integration model's schema comment for why Google Search Console/
 * Analytics, the AI providers, and Resend email are deliberately NOT
 * here. CRM has no testConnection: no vendor is named for it, so there's
 * no API to call — saving credentials marks it Connected without an
 * independent live check, and the admin UI says so rather than faking a
 * verified result.
 */
export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  GOOGLE_BUSINESS_PROFILE: {
    id: "GOOGLE_BUSINESS_PROFILE",
    label: "Google Business Profile",
    category: "Local SEO",
    description: "A manually-generated OAuth access token with Business Profile access (not a full consent flow yet).",
    fields: [{ name: "accessToken", label: "Access Token", type: "password", required: true }],
    testConnection: testGoogleBusinessProfileConnection,
  },
  META: {
    id: "META",
    label: "Meta (Facebook/Instagram)",
    category: "Advertising",
    description: "A Graph API access token for a Meta Business account.",
    fields: [{ name: "accessToken", label: "Access Token", type: "password", required: true }],
    testConnection: testMetaConnection,
  },
  CRM: {
    id: "CRM",
    label: "CRM",
    category: "Sales",
    description: "A generic API-key connection for whichever CRM this account uses. No live check is available without a named vendor.",
    fields: [
      { name: "apiKey", label: "API Key", type: "password", required: true },
      { name: "baseUrl", label: "Base URL", type: "url", placeholder: "https://api.yourcrm.com", required: false },
    ],
  },
  SLACK: {
    id: "SLACK",
    label: "Slack",
    category: "Notifications",
    description: "A Slack bot token (xoxb-...) for posting notifications.",
    fields: [
      { name: "botToken", label: "Bot Token", type: "password", placeholder: "xoxb-...", required: true },
      { name: "defaultChannel", label: "Default Channel", type: "text", placeholder: "#growth-alerts", required: false },
    ],
    testConnection: testSlackConnection,
  },
  WORDPRESS: {
    id: "WORDPRESS",
    label: "WordPress",
    category: "CMS",
    description: "A WordPress REST API connection, authenticated with an Application Password.",
    fields: [
      { name: "siteUrl", label: "Site URL", type: "url", placeholder: "https://example.com", required: true },
      { name: "username", label: "Username", type: "text", required: true },
      { name: "applicationPassword", label: "Application Password", type: "password", required: true },
    ],
    testConnection: testWordPressConnection,
  },
  WEBHOOKS: {
    id: "WEBHOOKS",
    label: "Outbound Webhooks",
    category: "Automation",
    description: "A URL this site sends event payloads to, optionally HMAC-signed with a shared secret.",
    fields: [
      { name: "url", label: "Endpoint URL", type: "url", required: true },
      { name: "secret", label: "Signing Secret", type: "password", placeholder: "optional", required: false },
    ],
    testConnection: testWebhookConnection,
  },
};

export function listProviderFieldDefs(): ProviderFieldDefinition[] {
  return Object.values(PROVIDER_REGISTRY).map((def) => ({
    id: def.id,
    label: def.label,
    category: def.category,
    description: def.description,
    fields: def.fields,
  }));
}
