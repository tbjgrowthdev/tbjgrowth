"use server";

import { listHealthScores, scanAndUpsertHealthScores } from "@/lib/content-health/health";

export async function scanAndUpsertHealthScoresAction() {
  return scanAndUpsertHealthScores();
}

export async function listHealthScoresAction() {
  return listHealthScores();
}
