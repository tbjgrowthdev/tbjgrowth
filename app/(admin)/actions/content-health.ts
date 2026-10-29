"use server";

import { listHealthScores, scanAndUpsertHealthScores } from "@/lib/content-health/health";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scanAndUpsertHealthScoresAction() {
  return guardMutation("EDIT", () => scanAndUpsertHealthScores());
}

export async function listHealthScoresAction() {
  return guardRead("EDIT", () => [], () => listHealthScores());
}
