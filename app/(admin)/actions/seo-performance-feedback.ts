"use server";

import { guardMutation, guardRead } from "@/lib/action-guard";
import { dismissPerformanceFeedback, listPerformanceFeedback, scanAndUpsertPerformanceFeedback } from "@/lib/seo-performance-feedback/scan";

export async function scanAndUpsertPerformanceFeedbackAction() {
  return guardMutation("EDIT", () => scanAndUpsertPerformanceFeedback());
}

export async function listPerformanceFeedbackAction() {
  return guardRead("EDIT", () => [], () => listPerformanceFeedback());
}

export async function dismissPerformanceFeedbackAction(id: string) {
  return guardMutation("EDIT", () => dismissPerformanceFeedback(id));
}
