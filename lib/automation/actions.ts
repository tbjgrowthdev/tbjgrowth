import { prisma } from "@/lib/prisma";
import type { AutomationActionType, ContentType } from "@/lib/generated/prisma/client";
import { callAiForJson } from "@/lib/content-pipeline/ai";
import { buildSchemaPrompt } from "@/lib/content-pipeline/prompts";
import { getContentRecord, patchContent, publicUrlFor } from "@/lib/content-pipeline/content-helpers";
import type { PipelineContentType } from "@/lib/content-pipeline/types";
import { runSeoAudit } from "@/lib/seo-audits/run";
import { generateRefreshDraft, upsertRefreshCandidate } from "@/lib/content-refresh/refresh";
import type { DetectedSignal, RefreshSignalType } from "@/lib/content-refresh/types";
import { decryptJson } from "@/lib/integrations/crypto";
import { postSlackMessage } from "@/lib/integrations/providers/slack";
import { sendWebhookEvent } from "@/lib/integrations/providers/webhooks";
import { sendAutomationNotification } from "@/lib/email";
import { EVENT_LABEL, type AutomationEventPayload } from "./types";
import { buildSocialDraftPrompt } from "./prompts";

export type ActionResult = { success: true; output: Record<string, unknown> } | { success: false; error: string };

function ok(output: Record<string, unknown> = {}): ActionResult {
  return { success: true, output };
}
function fail(error: string): ActionResult {
  return { success: false, error };
}

const baseUrl = () => process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

// GENERATE_SCHEMA, GENERATE_SOCIAL_DRAFT, and CREATE_REFRESH_DRAFT only
// make sense for Post/CaseStudy — the same scope as the AI Content
// Pipeline's own PipelineContentType, which these actions reuse directly
// (getContentRecord/patchContent have no Page support).
function asPipelineContentType(contentType: ContentType): PipelineContentType | null {
  return contentType === "POST" || contentType === "CASE_STUDY" ? (contentType as PipelineContentType) : null;
}

async function generateSchemaAction(payload: AutomationEventPayload): Promise<ActionResult> {
  const pct = asPipelineContentType(payload.contentType);
  if (!pct) return fail("Generate schema is only supported for Post/Case Study content");

  const content = await getContentRecord(pct, payload.contentId);
  if (!content) return fail("Content not found");

  const schemaType = pct === "POST" ? "BlogPosting" : "Article";
  const prompt = await buildSchemaPrompt({
    schemaType,
    title: content.title,
    description: content.metaDescription || content.excerpt || "",
    canonicalUrl: `${baseUrl()}${publicUrlFor(pct, content.slug)}`,
    authorName: "TBJ Growth",
    datePublished: content.createdAt.toISOString(),
    imageUrl: content.featuredImage,
  });
  const { data } = await callAiForJson<{ schema: Record<string, unknown> }>(prompt.system, prompt.user);
  if (!data.schema || data.schema["@context"] !== "https://schema.org" || !data.schema["@type"]) {
    return fail("The AI provider returned an invalid schema.org object");
  }

  const patchResult = await patchContent(pct, payload.contentId, { schemaJson: JSON.stringify(data.schema) });
  if (!patchResult.success) return fail(patchResult.error || "Failed to save schema");
  return ok({ schemaType: data.schema["@type"] });
}

// The sitemap routes are `force-dynamic` and read the DB live on every
// request (see lib/sitemap.ts) — there is nothing to regenerate. This
// step exists so a rule's chain can still show "Update sitemap" as an
// explicit, confirmed step rather than silently dropping it from the UI.
async function updateSitemapAction(): Promise<ActionResult> {
  return ok({ note: "Sitemap is generated live on every request — no action needed." });
}

async function runSeoAuditAction(): Promise<ActionResult> {
  const run = await runSeoAudit("manual");
  return ok({ auditRunId: run.id, totalFindings: run.totalFindings });
}

async function generateSocialDraftAction(payload: AutomationEventPayload): Promise<ActionResult> {
  const pct = asPipelineContentType(payload.contentType);
  if (!pct) return fail("Generate social draft is only supported for Post/Case Study content");

  const content = await getContentRecord(pct, payload.contentId);
  if (!content) return fail("Content not found");

  const url = `${baseUrl()}${publicUrlFor(pct, content.slug)}`;
  const prompt = await buildSocialDraftPrompt({ title: content.title, excerpt: content.excerpt || content.metaDescription || "", url });
  const { data } = await callAiForJson<{ linkedinText: string; twitterText: string }>(prompt.system, prompt.user);

  const draft = await prisma.socialDraft.create({
    data: { contentType: payload.contentType, contentId: payload.contentId, linkedinText: data.linkedinText, twitterText: data.twitterText },
  });
  return ok({ socialDraftId: draft.id });
}

function eventSummaryText(payload: AutomationEventPayload): string {
  const title = payload.data.title || payload.contentId;
  const lines = [`${EVENT_LABEL[payload.event]}: ${title}`];
  if (payload.data.aiSummary) lines.push(payload.data.aiSummary);
  if (payload.data.aiRecommendations?.length) lines.push(`Recommendations:\n${payload.data.aiRecommendations.map((r) => `- ${r}`).join("\n")}`);
  return lines.join("\n\n");
}

async function notifyTeamAction(payload: AutomationEventPayload, config: Record<string, string>): Promise<ActionResult> {
  const channel = config.channel;
  const message = eventSummaryText(payload);

  if (channel === "slack") {
    const row = await prisma.integration.findUnique({ where: { provider: "SLACK" } });
    if (!row?.encryptedCredentials) return fail("Slack is not connected in the Integration Hub");
    const credentials = decryptJson<Record<string, string>>(row.encryptedCredentials);
    const slackChannel = config.target || credentials.defaultChannel;
    if (!slackChannel) return fail("No Slack channel configured — set a default channel in the Integration Hub or on this step");
    try {
      await postSlackMessage(credentials.botToken, slackChannel, message);
      return ok({ channel: "slack", target: slackChannel });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to post to Slack");
    }
  }

  if (channel === "webhook") {
    const row = await prisma.integration.findUnique({ where: { provider: "WEBHOOKS" } });
    if (!row?.encryptedCredentials) return fail("No outbound webhook is connected in the Integration Hub");
    const credentials = decryptJson<Record<string, string>>(row.encryptedCredentials);
    try {
      await sendWebhookEvent(credentials.url, credentials.secret, { event: payload.event, contentType: payload.contentType, contentId: payload.contentId, data: payload.data, sentAt: new Date().toISOString() });
      return ok({ channel: "webhook" });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to call webhook");
    }
  }

  if (channel === "email") {
    const settings = await prisma.siteSetting.findFirst();
    try {
      await sendAutomationNotification(`Automation: ${EVENT_LABEL[payload.event]}`, message, settings?.email);
      return ok({ channel: "email", to: settings?.email ?? null });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Failed to send email");
    }
  }

  return fail(`Unknown notification channel "${channel}"`);
}

async function createPerformanceAnalysisAction(payload: AutomationEventPayload): Promise<ActionResult> {
  const feedbackId = payload.data.feedbackId;
  if (!feedbackId) return fail("This event has no attached SEO Performance Feedback analysis — only the six decline/decay/cannibalization events produce one");
  const row = await prisma.performanceFeedback.findUnique({ where: { id: feedbackId } });
  if (!row) return fail("The performance feedback analysis no longer exists");
  return ok({ feedbackId: row.id, severity: row.severity, summary: row.aiSummary });
}

// Maps the six PerformanceSignalType values onto RefreshSignalType so a
// signal from the Performance Feedback event can seed a Content Refresh
// cycle — CONTENT_DECAY (the merged OLD_CONTENT/OUTDATED_MENTION signal
// from lib/seo-performance-feedback/collect.ts) maps to the closest single
// RefreshSignalType; CANNIBALIZATION has no refresh-draft equivalent (a
// rewrite doesn't fix two pages competing for the same keyword) and is
// dropped rather than forced into an unrelated bucket.
const SIGNAL_TO_REFRESH: Partial<Record<string, RefreshSignalType>> = {
  CONTENT_DECAY: "OLD_CONTENT",
  RANKING_DECLINE: "RANKING_DECLINE",
  TRAFFIC_DECLINE: "TRAFFIC_DECLINE",
  CTR_DECLINE: "CTR_DECLINE",
  CONVERSION_DECLINE: "CONVERSION_DECLINE",
};

async function createRefreshDraftAction(payload: AutomationEventPayload): Promise<ActionResult> {
  const pct = asPipelineContentType(payload.contentType);
  if (!pct) return fail("Create refresh draft is only supported for Post/Case Study content");

  const signals: DetectedSignal[] = (payload.data.signals ?? [])
    .map((s) => {
      const type = SIGNAL_TO_REFRESH[s.type];
      return type ? { type, detail: s.detail } : null;
    })
    .filter((s): s is DetectedSignal => s !== null);

  if (signals.length === 0) {
    return fail("No signal on this event can seed a content refresh (e.g. a pure cannibalization signal needs a different fix than a rewrite)");
  }

  const refresh = await upsertRefreshCandidate(pct, payload.contentId, signals, null);
  const result = await generateRefreshDraft(refresh.id);
  if (!result.success) return fail(result.error || "Failed to generate refresh draft");
  return ok({ refreshId: refresh.id });
}

async function assignReviewerAction(payload: AutomationEventPayload, config: Record<string, string>): Promise<ActionResult> {
  const userId = config.userId;
  if (!userId) return fail("No reviewer selected on this step");
  // Dynamic import: lib/workflow.ts itself fires CONTENT_PUBLISHED through
  // this module's engine, so a static import here would be circular.
  const { assignUser } = await import("@/lib/workflow");
  const result = await assignUser(payload.contentType, payload.contentId, "reviewer", userId);
  if (!result.success) return fail(result.error || "Failed to assign reviewer");
  return ok({ reviewerId: userId });
}

export async function executeAction(actionType: AutomationActionType, payload: AutomationEventPayload, config: Record<string, string>): Promise<ActionResult> {
  try {
    switch (actionType) {
      case "GENERATE_SCHEMA":
        return await generateSchemaAction(payload);
      case "UPDATE_SITEMAP":
        return await updateSitemapAction();
      case "RUN_SEO_AUDIT":
        return await runSeoAuditAction();
      case "GENERATE_SOCIAL_DRAFT":
        return await generateSocialDraftAction(payload);
      case "NOTIFY_TEAM":
        return await notifyTeamAction(payload, config);
      case "CREATE_PERFORMANCE_ANALYSIS":
        return await createPerformanceAnalysisAction(payload);
      case "CREATE_REFRESH_DRAFT":
        return await createRefreshDraftAction(payload);
      case "ASSIGN_REVIEWER":
        return await assignReviewerAction(payload, config);
      default:
        return fail(`Unknown action type "${actionType}"`);
    }
  } catch (error) {
    console.error(`Automation action ${actionType} failed:`, error);
    return fail(error instanceof Error ? error.message : "Action failed");
  }
}
