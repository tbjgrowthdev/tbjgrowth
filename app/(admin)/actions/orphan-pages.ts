"use server";

import { dismissOrphanPage, listOrphanPages, markOrphanPageResolved, scanAndUpsertOrphanPages } from "@/lib/orphan-pages/orphan-pages";

export async function scanAndUpsertOrphanPagesAction() {
  return scanAndUpsertOrphanPages();
}

export async function listOrphanPagesAction() {
  return listOrphanPages();
}

export async function dismissOrphanPageAction(id: string) {
  return dismissOrphanPage(id);
}

export async function markOrphanPageResolvedAction(id: string) {
  return markOrphanPageResolved(id);
}
