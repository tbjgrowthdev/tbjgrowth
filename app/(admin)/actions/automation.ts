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
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function listAutomationRulesAction() {
  return guardRead("EDIT", () => [], () => listAutomationRules());
}

export async function getAutomationRuleAction(id: string) {
  return guardRead("EDIT", () => null, () => getAutomationRule(id));
}

export async function createAutomationRuleAction(input: RuleInput) {
  return guardMutation("SETTINGS_MANAGEMENT", () => createAutomationRule(input));
}

export async function updateAutomationRuleAction(id: string, input: RuleInput) {
  return guardMutation("SETTINGS_MANAGEMENT", () => updateAutomationRule(id, input));
}

export async function toggleAutomationRuleAction(id: string, enabled: boolean) {
  return guardMutation("SETTINGS_MANAGEMENT", () => toggleAutomationRule(id, enabled));
}

export async function deleteAutomationRuleAction(id: string) {
  return guardMutation("SETTINGS_MANAGEMENT", () => deleteAutomationRule(id));
}

export async function listAutomationRunsAction() {
  return guardRead("EDIT", () => [], () => listAutomationRuns());
}

export async function approveAutomationStepAction(stepId: string) {
  return guardMutation("APPROVE", () => approveStep(stepId));
}

export async function rejectAutomationStepAction(stepId: string) {
  return guardMutation("APPROVE", () => rejectStep(stepId));
}

export async function runAutomationRuleManuallyAction(ruleId: string, contentType: ContentType, contentId: string) {
  return guardMutation("EDIT", () => runRuleManually(ruleId, contentType, contentId));
}

export async function listSocialDraftsAction() {
  return guardRead("EDIT", () => [], () => listSocialDrafts());
}

export async function dismissSocialDraftAction(id: string) {
  return guardMutation("EDIT", () => dismissSocialDraft(id));
}
