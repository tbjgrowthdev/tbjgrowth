"use server";

import {
  dismissCannibalizationPair,
  listCannibalizationPairs,
  markCannibalizationResolved,
  scanAndUpsertCannibalizationPairs,
} from "@/lib/content-cannibalization/cannibalization";

export async function scanAndUpsertCannibalizationPairsAction() {
  return scanAndUpsertCannibalizationPairs();
}

export async function listCannibalizationPairsAction() {
  return listCannibalizationPairs();
}

export async function dismissCannibalizationPairAction(id: string) {
  return dismissCannibalizationPair(id);
}

export async function markCannibalizationResolvedAction(id: string) {
  return markCannibalizationResolved(id);
}
