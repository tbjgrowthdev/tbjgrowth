"use server";

import type { Brief } from "@/lib/content-pipeline/types";
import {
  approveRunForPublish,
  createPipelineRun,
  deletePipelineRun,
  getPipelineRun,
  getPipelineRuns,
  publishRun,
  runDraftStage,
  runInternalLinksStage,
  runOutlineStage,
  runQaStage,
  runResearchStage,
  runSchemaStage,
  runSearchIntentStage,
  runSeoStage,
} from "@/lib/content-pipeline/stages";
import { getAllJobs, getJobsForRun } from "@/lib/content-pipeline/jobs";
import { getCostSummary } from "@/lib/content-pipeline/costs";
import { activatePromptVersion, getPromptTemplateDetail, listPromptTemplates, savePromptVersion } from "@/lib/content-pipeline/prompt-library";
import type { PromptCategory } from "@/lib/generated/prisma/client";

export async function createPipelineRunAction(brief: Brief) {
  return createPipelineRun(brief);
}

export async function getPipelineRunsAction() {
  return getPipelineRuns();
}

export async function getPipelineRunAction(id: string) {
  return getPipelineRun(id);
}

export async function deletePipelineRunAction(id: string) {
  return deletePipelineRun(id);
}

export async function advanceSearchIntentAction(runId: string) {
  return runSearchIntentStage(runId);
}

export async function advanceResearchAction(runId: string) {
  return runResearchStage(runId);
}

export async function advanceOutlineAction(runId: string) {
  return runOutlineStage(runId);
}

export async function advanceDraftAction(runId: string) {
  return runDraftStage(runId);
}

export async function advanceSeoAction(runId: string) {
  return runSeoStage(runId);
}

export async function advanceInternalLinksAction(runId: string) {
  return runInternalLinksStage(runId);
}

export async function advanceSchemaAction(runId: string) {
  return runSchemaStage(runId);
}

export async function advanceQaAction(runId: string) {
  return runQaStage(runId);
}

export async function approveRunAction(runId: string) {
  return approveRunForPublish(runId);
}

export async function publishRunAction(runId: string, mode: "publish" | "submit" | "schedule", schedule?: { date: string; time: string; timezone: string }) {
  return publishRun(runId, mode, schedule);
}

export async function getJobsForRunAction(runId: string) {
  return getJobsForRun(runId);
}

export async function getAllJobsAction() {
  return getAllJobs();
}

const RETRY_BY_STAGE: Record<string, (runId: string) => Promise<{ success: boolean; error?: string }>> = {
  SEARCH_INTENT: runSearchIntentStage,
  RESEARCH: runResearchStage,
  OUTLINE: runOutlineStage,
  DRAFT: runDraftStage,
  SEO: runSeoStage,
  INTERNAL_LINKS: runInternalLinksStage,
  SCHEMA: runSchemaStage,
  QA: runQaStage,
};

// Used by the global Job Queue list to retry a FAILED job without
// navigating into that run's wizard first. Reuses the exact same
// stage-advance functions the wizard calls — a retry from here and a click
// on "Retry" inside the wizard are the same idempotent operation.
export async function retryJobAction(runId: string, stage: string) {
  const fn = RETRY_BY_STAGE[stage];
  if (!fn) return { success: false, error: `Stage "${stage}" cannot be retried from here` };
  return fn(runId);
}

export async function getCostSummaryAction() {
  return getCostSummary();
}

export async function listPromptTemplatesAction() {
  return listPromptTemplates();
}

export async function getPromptTemplateDetailAction(category: PromptCategory) {
  return getPromptTemplateDetail(category);
}

export async function savePromptVersionAction(
  category: PromptCategory,
  data: { name: string; description?: string; systemPrompt?: string; bodyTemplate: string; changeNote?: string }
) {
  return savePromptVersion(category, data);
}

export async function activatePromptVersionAction(templateId: string, versionId: string) {
  return activatePromptVersion(templateId, versionId);
}
