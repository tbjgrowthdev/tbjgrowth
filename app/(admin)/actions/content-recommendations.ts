"use server";

import {
  dismissRecommendation,
  listRecommendations,
  markRecommendationInProgress,
  scanAndUpsertRecommendations,
} from "@/lib/content-recommendations/recommend";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scanAndUpsertRecommendationsAction() {
  return guardMutation("EDIT", () => scanAndUpsertRecommendations());
}

export async function listRecommendationsAction() {
  return guardRead("EDIT", () => [], () => listRecommendations());
}

export async function dismissRecommendationAction(id: string) {
  return guardMutation("EDIT", () => dismissRecommendation(id));
}

export async function markRecommendationInProgressAction(id: string) {
  return guardMutation("EDIT", () => markRecommendationInProgress(id));
}
