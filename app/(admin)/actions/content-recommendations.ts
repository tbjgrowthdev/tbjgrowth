"use server";

import {
  dismissRecommendation,
  listRecommendations,
  markRecommendationInProgress,
  scanAndUpsertRecommendations,
} from "@/lib/content-recommendations/recommend";

export async function scanAndUpsertRecommendationsAction() {
  return scanAndUpsertRecommendations();
}

export async function listRecommendationsAction() {
  return listRecommendations();
}

export async function dismissRecommendationAction(id: string) {
  return dismissRecommendation(id);
}

export async function markRecommendationInProgressAction(id: string) {
  return markRecommendationInProgress(id);
}
