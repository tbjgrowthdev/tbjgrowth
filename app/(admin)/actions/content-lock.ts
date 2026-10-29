"use server";

import { requireSession } from "@/lib/auth-guard";
import { acquireLock, takeOverLock, heartbeatLock, releaseLock, type ContentKind } from "@/lib/content-lock";

export async function acquireContentLock(contentType: ContentKind, contentId: string) {
  try {
    await requireSession();
    return await acquireLock(contentType, contentId);
  } catch (error) {
    console.error("Failed to acquire content lock:", error);
    return { locked: false as const };
  }
}

export async function takeOverContentLock(contentType: ContentKind, contentId: string) {
  try {
    await requireSession();
    return await takeOverLock(contentType, contentId);
  } catch (error) {
    console.error("Failed to take over content lock:", error);
    return { locked: false as const };
  }
}

export async function heartbeatContentLock(contentType: ContentKind, contentId: string) {
  try {
    await requireSession();
    return await heartbeatLock(contentType, contentId);
  } catch (error) {
    console.error("Failed to refresh content lock:", error);
    return { locked: false as const };
  }
}

export async function releaseContentLock(contentType: ContentKind, contentId: string) {
  try {
    await requireSession();
    await releaseLock(contentType, contentId);
    return { success: true };
  } catch (error) {
    console.error("Failed to release content lock:", error);
    return { success: false };
  }
}
