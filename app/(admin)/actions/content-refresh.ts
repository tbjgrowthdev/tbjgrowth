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

export async function scanAndUpsertCandidatesAction() {
  return scanAndUpsertCandidates();
}

export async function listRefreshCandidatesAction() {
  return listRefreshCandidates();
}

export async function getRefreshDetailAction(id: string) {
  return getRefreshDetail(id);
}

export async function generateRefreshDraftAction(id: string) {
  return generateRefreshDraft(id);
}

export async function approveRefreshDraftAction(id: string) {
  return approveRefreshDraft(id);
}

export async function rejectRefreshDraftAction(id: string) {
  return rejectRefreshDraft(id);
}

export async function applyRefreshDraftAction(id: string) {
  return applyRefreshDraft(id);
}

export async function getJobsForRefreshAction(id: string) {
  return getJobsForRefresh(id);
}
