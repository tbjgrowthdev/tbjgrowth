"use server";

import {
  dismissCannibalizationPair,
  listCannibalizationPairs,
  markCannibalizationResolved,
  scanAndUpsertCannibalizationPairs,
} from "@/lib/content-cannibalization/cannibalization";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scanAndUpsertCannibalizationPairsAction() {
  return guardMutation("EDIT", () => scanAndUpsertCannibalizationPairs());
}

export async function listCannibalizationPairsAction() {
  return guardRead("EDIT", () => [], () => listCannibalizationPairs());
}

export async function dismissCannibalizationPairAction(id: string) {
  return guardMutation("EDIT", () => dismissCannibalizationPair(id));
}

export async function markCannibalizationResolvedAction(id: string) {
  return guardMutation("EDIT", () => markCannibalizationResolved(id));
}
