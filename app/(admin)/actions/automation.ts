"use server";

import type { ContentType } from "@/lib/generated/prisma/client";
import {
  createAutomationRule,
  deleteAutomationRule,
  dismissSocialDraft,
  getAutomationRule,
  listAutomationRules,
  listAutomationRuns,
  listSocialDrafts,
  toggleAutomationRule,
  updateAutomationRule,
  type RuleInput,
} from "@/lib/automation/manage";
import { approveStep, rejectStep, runRuleManually } from "@/lib/automation/engine";

export async function listAutomationRulesAction() {
  return listAutomationRules();
}

export async function getAutomationRuleAction(id: string) {
  return getAutomationRule(id);
}

export async function createAutomationRuleAction(input: RuleInput) {
  return createAutomationRule(input);
}

export async function updateAutomationRuleAction(id: string, input: RuleInput) {
  return updateAutomationRule(id, input);
}

export async function toggleAutomationRuleAction(id: string, enabled: boolean) {
  return toggleAutomationRule(id, enabled);
}

export async function deleteAutomationRuleAction(id: string) {
  return deleteAutomationRule(id);
}

export async function listAutomationRunsAction() {
  return listAutomationRuns();
}

export async function approveAutomationStepAction(stepId: string) {
  return approveStep(stepId);
}

export async function rejectAutomationStepAction(stepId: string) {
  return rejectStep(stepId);
}

export async function runAutomationRuleManuallyAction(ruleId: string, contentType: ContentType, contentId: string) {
  return runRuleManually(ruleId, contentType, contentId);
}

export async function listSocialDraftsAction() {
  return listSocialDrafts();
}

export async function dismissSocialDraftAction(id: string) {
  return dismissSocialDraft(id);
}
