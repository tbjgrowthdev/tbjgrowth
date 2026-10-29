"use server";

import { dismissOrphanPage, listOrphanPages, markOrphanPageResolved, scanAndUpsertOrphanPages } from "@/lib/orphan-pages/orphan-pages";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function scanAndUpsertOrphanPagesAction() {
  return guardMutation("SEO_MANAGEMENT", () => scanAndUpsertOrphanPages());
}

export async function listOrphanPagesAction() {
  return guardRead("SEO_MANAGEMENT", () => [], () => listOrphanPages());
}

export async function dismissOrphanPageAction(id: string) {
  return guardMutation("SEO_MANAGEMENT", () => dismissOrphanPage(id));
}

export async function markOrphanPageResolvedAction(id: string) {
  return guardMutation("SEO_MANAGEMENT", () => markOrphanPageResolved(id));
}
