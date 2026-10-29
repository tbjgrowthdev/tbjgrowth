"use server";

import {
  applyRefreshDraft,
  approveRefreshDraft,
  generateRefreshDraft,
  getRefreshDetail,
  listRefreshCandidates,
  rejectRefreshDraft,
  scanAndUpsertCandidates,
} from "@/lib/content-refresh/refresh";
import { getJobsForRefresh } from "@/lib/content-pipeline/jobs";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scanAndUpsertCandidatesAction() {
  return guardMutation("EDIT", () => scanAndUpsertCandidates());
}

export async function listRefreshCandidatesAction() {
  return guardRead("EDIT", () => [], () => listRefreshCandidates());
}

export async function getRefreshDetailAction(id: string) {
  return guardRead("EDIT", () => null, () => getRefreshDetail(id));
}

export async function generateRefreshDraftAction(id: string) {
  return guardMutation("EDIT", () => generateRefreshDraft(id));
}

export async function approveRefreshDraftAction(id: string) {
  return guardMutation("APPROVE", () => approveRefreshDraft(id));
}

export async function rejectRefreshDraftAction(id: string) {
  return guardMutation("EDIT", () => rejectRefreshDraft(id));
}

export async function applyRefreshDraftAction(id: string) {
  return guardMutation("PUBLISH", () => applyRefreshDraft(id));
}

export async function getJobsForRefreshAction(id: string) {
  return guardRead("EDIT", () => [], () => getJobsForRefresh(id));
}
