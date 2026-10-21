import type { AutomationActionType, AutomationEvent, ContentType } from "@/lib/generated/prisma/client";
import type { PerformanceFeedbackSeverity, PerformanceSignalType } from "@/lib/seo-performance-feedback/types";

export type { AutomationActionType, AutomationEvent };

export const AUTOMATION_EVENTS: AutomationEvent[] = [
  "CONTENT_PUBLISHED",
  "RANKING_DECLINE",
  "CTR_DECLINE",
  "TRAFFIC_DECLINE",
  "CONVERSION_DECLINE",
  "CONTENT_DECAY",
  "CANNIBALIZATION",
];

export const EVENT_LABEL: Record<AutomationEvent, string> = {
  CONTENT_PUBLISHED: "Content published",
  RANKING_DECLINE: "Ranking decline",
  CTR_DECLINE: "CTR decline",
  TRAFFIC_DECLINE: "Traffic decline",
  CONVERSION_DECLINE: "Conversion decline",
  CONTENT_DECAY: "Content decay",
  CANNIBALIZATION: "Cannibalization",
};

// Every signal event shares its name 1:1 with PerformanceSignalType — see
// lib/seo-performance-feedback/scan.ts, the only place that fires them.
export const SIGNAL_EVENTS: AutomationEvent[] = ["RANKING_DECLINE", "CTR_DECLINE", "TRAFFIC_DECLINE", "CONVERSION_DECLINE", "CONTENT_DECAY", "CANNIBALIZATION"];

export const AUTOMATION_ACTION_TYPES: AutomationActionType[] = [
  "GENERATE_SCHEMA",
  "UPDATE_SITEMAP",
  "RUN_SEO_AUDIT",
  "GENERATE_SOCIAL_DRAFT",
  "NOTIFY_TEAM",
  "CREATE_PERFORMANCE_ANALYSIS",
  "CREATE_REFRESH_DRAFT",
  "ASSIGN_REVIEWER",
];

export const ACTION_LABEL: Record<AutomationActionType, string> = {
  GENERATE_SCHEMA: "Generate schema",
  UPDATE_SITEMAP: "Update sitemap",
  RUN_SEO_AUDIT: "Run SEO audit",
  GENERATE_SOCIAL_DRAFT: "Generate social draft",
  NOTIFY_TEAM: "Notify team",
  CREATE_PERFORMANCE_ANALYSIS: "Create analysis",
  CREATE_REFRESH_DRAFT: "Create refresh draft",
  ASSIGN_REVIEWER: "Assign reviewer",
};

export const ACTION_DESCRIPTION: Record<AutomationActionType, string> = {
  GENERATE_SCHEMA: "Writes AI-generated schema.org JSON-LD directly onto the live, published content.",
  UPDATE_SITEMAP: "No-op confirmation step — the sitemap is generated live on every request, so there's nothing to regenerate.",
  RUN_SEO_AUDIT: "Runs the full 14-category Automated SEO Audit and records a new run.",
  GENERATE_SOCIAL_DRAFT: "Drafts LinkedIn and X/Twitter copy for a human to review and post manually — never posts anything itself.",
  NOTIFY_TEAM: "Sends a message to Slack, a connected webhook, or email.",
  CREATE_PERFORMANCE_ANALYSIS: "Attaches the SEO Performance Feedback analysis that triggered this event to the run.",
  CREATE_REFRESH_DRAFT: "Starts (or reuses) a Content Refresh cycle for this content and generates an AI-drafted revision — staged for separate human review, never applied automatically.",
  ASSIGN_REVIEWER: "Assigns a reviewer to the content, same as the Approvals panel's own assignment.",
};

// GENERATE_SCHEMA is the only action that writes directly to live,
// published content with no separate human-approval step already built
// elsewhere — every other action either writes nothing live (drafts,
// notifications, analyses) or already has its own later approval gate
// (CREATE_REFRESH_DRAFT's draft still needs a human to approve+apply it
// via the existing Content Refresh page). This is only the *default*;
// an admin can require approval on any step when building a rule.
export const DEFAULT_REQUIRES_APPROVAL: Record<AutomationActionType, boolean> = {
  GENERATE_SCHEMA: true,
  UPDATE_SITEMAP: false,
  RUN_SEO_AUDIT: false,
  GENERATE_SOCIAL_DRAFT: false,
  NOTIFY_TEAM: false,
  CREATE_PERFORMANCE_ANALYSIS: false,
  CREATE_REFRESH_DRAFT: false,
  ASSIGN_REVIEWER: false,
};

export interface RuleConditions {
  contentTypes?: ContentType[];
  severities?: PerformanceFeedbackSeverity[];
}

export interface ActionStep {
  type: AutomationActionType;
  config: Record<string, string>;
  requiresApproval: boolean;
}

// What an event handed to lib/automation/engine.ts actually carries.
// `data` is intentionally loose (Record<string, unknown>) — each firing
// site (lib/workflow.ts, lib/seo-performance-feedback/scan.ts) puts in
// whatever's relevant to that event, and each action reads only the keys
// it needs, same shape as PerformanceFeedbackCandidate's own signals.
export interface AutomationEventPayload {
  event: AutomationEvent;
  contentType: ContentType;
  contentId: string;
  data: {
    title?: string;
    slug?: string;
    severity?: PerformanceFeedbackSeverity;
    feedbackId?: string;
    aiSummary?: string;
    aiRecommendations?: string[];
    signals?: { type: PerformanceSignalType; detail: string }[];
    [key: string]: unknown;
  };
}
