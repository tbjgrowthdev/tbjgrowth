"use server";

import { getVersionHistory, compareVersions, restoreVersion } from "@/lib/versioning";
import type { ContentType } from "@/lib/generated/prisma/client";
import { guardMutation, guardRead } from "@/lib/action-guard";

export async function getContentVersionHistory(contentType: ContentType, contentId: string) {
  return guardRead("SESSION", () => [], () => getVersionHistory(contentType, contentId));
}

export async function compareContentVersions(contentType: ContentType, contentId: string, versionA: number, versionB: number) {
  return guardRead("SESSION", () => ({ a: null, b: null }), () => compareVersions(contentType, contentId, versionA, versionB));
}

export async function restoreContentVersion(contentType: ContentType, contentId: string, versionNumber: number) {
  return guardMutation("EDIT", () => restoreVersion(contentType, contentId, versionNumber));
}
