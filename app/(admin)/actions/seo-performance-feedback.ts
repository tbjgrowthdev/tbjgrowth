"use server";

import { dismissPerformanceFeedback, listPerformanceFeedback, scanAndUpsertPerformanceFeedback } from "@/lib/seo-performance-feedback/scan";

export async function scanAndUpsertPerformanceFeedbackAction() {
  return scanAndUpsertPerformanceFeedback();
}

export async function listPerformanceFeedbackAction() {
  return listPerformanceFeedback();
}

export async function dismissPerformanceFeedbackAction(id: string) {
  return dismissPerformanceFeedback(id);
}
