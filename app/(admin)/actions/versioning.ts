"use server";

import { getVersionHistory, compareVersions, restoreVersion } from "@/lib/versioning";
import type { ContentType } from "@prisma/client";

export async function getContentVersionHistory(contentType: ContentType, contentId: string) {
  return getVersionHistory(contentType, contentId);
}

export async function compareContentVersions(contentType: ContentType, contentId: string, versionA: number, versionB: number) {
  return compareVersions(contentType, contentId, versionA, versionB);
}

export async function restoreContentVersion(contentType: ContentType, contentId: string, versionNumber: number) {
  return restoreVersion(contentType, contentId, versionNumber);
}
