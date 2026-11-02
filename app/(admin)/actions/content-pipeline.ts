"use server";

import type { Brief } from "@/lib/content-pipeline/types";
import {
  applyInternalLinks,
  approveRunForPublish,
  attachGeneratedImage,
  attachOwnImage,
  createPipelineRun,
  decideLinkSuggestion,
  deletePipelineRun,
  getPipelineRun,
  getPipelineRuns,
  publishRun,
  runDraftStage,
  runImageStage,
  runInternalLinksStage,
  runOutlineStage,
  runQaStage,
  runResearchStage,
  runSchemaStage,
  runSearchIntentStage,
  runSeoStage,
  skipImageStage,
  updatePendingImageAltText,
} from "@/lib/content-pipeline/stages";
import { getAllJobs, getJobsForRun } from "@/lib/content-pipeline/jobs";
import { AI_STAGE_RUNNERS } from "@/lib/content-pipeline/stage-runners";
import { getCostSummary } from "@/lib/content-pipeline/costs";
import { activatePromptVersion, getPromptTemplateDetail, listPromptTemplates, savePromptVersion } from "@/lib/content-pipeline/prompt-library";
import type { PromptCategory } from "@/lib/generated/prisma/client";
import { PROMPT_CATEGORIES } from "@/lib/content-pipeline/prompt-constants";
import { guardMutation, guardRead, type ActionAccess } from "@/lib/action-guard";

// Each action re-checks the same permission its lib function checks
// (lib/action-guard.ts explains why both layers check).

export async function createPipelineRunAction(brief: Brief) {
  return guardMutation("CREATE", () => createPipelineRun(brief));
}

export async function getPipelineRunsAction() {
  return guardRead("CREATE", () => [], () => getPipelineRuns());
}

export async function getPipelineRunAction(id: string) {
  return guardRead("CREATE", () => null, () => getPipelineRun(id));
}

export async function deletePipelineRunAction(id: string) {
  return guardMutation("CREATE", () => deletePipelineRun(id));
}

export async function advanceSearchIntentAction(runId: string) {
  return guardMutation("EDIT", () => runSearchIntentStage(runId));
}

export async function advanceResearchAction(runId: string) {
  return guardMutation("EDIT", () => runResearchStage(runId));
}

export async function advanceOutlineAction(runId: string) {
  return guardMutation("EDIT", () => runOutlineStage(runId));
}

export async function advanceDraftAction(runId: string) {
  return guardMutation("CREATE", () => runDraftStage(runId));
}

export async function advanceImageAction(runId: string) {
  return guardMutation("EDIT", () => runImageStage(runId));
}

export async function attachGeneratedImageAction(runId: string) {
  return guardMutation("EDIT", () => attachGeneratedImage(runId));
}

export async function attachOwnImageAction(runId: string, url: string, altText: string) {
  return guardMutation("EDIT", () => attachOwnImage(runId, url, altText));
}

export async function skipImageStageAction(runId: string) {
  return guardMutation("EDIT", () => skipImageStage(runId));
}

export async function updatePendingImageAltTextAction(runId: string, altText: string) {
  return guardMutation("EDIT", () => updatePendingImageAltText(runId, altText));
}

export async function advanceSeoAction(runId: string) {
  return guardMutation("EDIT", () => runSeoStage(runId));
}

export async function advanceInternalLinksAction(runId: string) {
  return guardMutation("EDIT", () => runInternalLinksStage(runId));
}

export async function decideLinkSuggestionAction(runId: string, suggestionId: string, decision: "approved" | "rejected") {
  return guardMutation("EDIT", () => decideLinkSuggestion(runId, suggestionId, decision));
}

export async function applyInternalLinksAction(runId: string) {
  return guardMutation("EDIT", () => applyInternalLinks(runId));
}

export async function advanceSchemaAction(runId: string) {
  return guardMutation("EDIT", () => runSchemaStage(runId));
}

export async function advanceQaAction(runId: string) {
  return guardMutation("EDIT", () => runQaStage(runId));
}

export async function approveRunAction(runId: string) {
  return guardMutation("APPROVE", () => approveRunForPublish(runId));
}

export async function publishRunAction(runId: string, mode: "publish" | "submit" | "schedule", schedule?: { date: string; time: string; timezone: string }) {
  // Same permission the matching workflow transition needs (lib/workflow.ts):
  // publishRun itself has no check and relies on transitionContent's.
  const access: Record<typeof mode, ActionAccess> = { submit: "CREATE", schedule: "SCHEDULE", publish: "PUBLISH" };
  if (!access[mode]) return { success: false as const, error: `Unknown publish mode "${mode}"` };
  return guardMutation(access[mode], () => publishRun(runId, mode, schedule));
}

export async function getJobsForRunAction(runId: string) {
  return guardRead("CREATE", () => [], () => getJobsForRun(runId));
}

export async function getAllJobsAction() {
  return guardRead("CREATE", () => [], () => getAllJobs());
}

// Used by the global Job Queue list to retry a FAILED job without
// navigating into that run's wizard first. Reuses the exact same
// stage-advance functions the wizard calls — a retry from here and a click
// on "Retry"/"Regenerate" inside the wizard are the same operation. Most
// of these are idempotent (a retry after COMPLETED is a safe no-op); IMAGE
// and INTERNAL_LINKS are the two deliberate exceptions that always do
// real work (see their own stage functions' comments).
export async function retryJobAction(runId: string, stage: string) {
  const runner = AI_STAGE_RUNNERS[stage];
  if (!runner) return { success: false, error: `Stage "${stage}" cannot be retried from here` };
  return guardMutation(runner.permission, () => runner.run(runId));
}

export async function getCostSummaryAction() {
  return guardRead("CREATE", () => null, () => getCostSummary());
}

export async function listPromptTemplatesAction() {
  return guardRead("SETTINGS_MANAGEMENT", () => PROMPT_CATEGORIES.map((category) => ({ category, template: null, updatedByName: null })), () => listPromptTemplates());
}

export async function getPromptTemplateDetailAction(category: PromptCategory) {
  return guardRead(
    "SETTINGS_MANAGEMENT",
    () => ({ category, template: null, authors: new Map<string, string>(), forbidden: true as const }),
    () => getPromptTemplateDetail(category)
  );
}

export async function savePromptVersionAction(
  category: PromptCategory,
  data: { name: string; description?: string; systemPrompt?: string; bodyTemplate: string; changeNote?: string }
) {
  return guardMutation("SETTINGS_MANAGEMENT", () => savePromptVersion(category, data));
}

export async function activatePromptVersionAction(templateId: string, versionId: string) {
  return guardMutation("SETTINGS_MANAGEMENT", () => activatePromptVersion(templateId, versionId));
}
