import prisma from "@/lib/prisma";
import { requireSession } from "@/lib/auth-guard";

export type ContentKind = "POST" | "PAGE" | "CASE_STUDY" | "SERVICE" | "LOCATION";

// A lock not refreshed within this window is treated as abandoned (tab
// closed without a clean unmount) and can be silently reclaimed by anyone.
const LOCK_TTL_MS = 90_000;

export type LockStatus =
  | { locked: false }
  | { locked: true; byMe: true }
  | { locked: true; byMe: false; lockedByName: string | null; lockedByEmail: string | null; acquiredAt: Date };

function isExpired(lastHeartbeat: Date): boolean {
  return Date.now() - lastHeartbeat.getTime() > LOCK_TTL_MS;
}

// Called when an edit form mounts. Claims the lock if free or expired;
// otherwise reports who currently holds it so the UI can show the warning.
export async function acquireLock(contentType: ContentKind, contentId: string): Promise<LockStatus> {
  const session = await requireSession();
  const existing = await prisma.contentLock.findUnique({
    where: { contentType_contentId: { contentType, contentId } },
  });

  if (existing) {
    const mine = existing.lockedById === session.user.id;
    if (!mine && !isExpired(existing.lastHeartbeat)) {
      return {
        locked: true,
        byMe: false,
        lockedByName: existing.lockedByName,
        lockedByEmail: existing.lockedByEmail,
        acquiredAt: existing.acquiredAt,
      };
    }

    await prisma.contentLock.update({
      where: { contentType_contentId: { contentType, contentId } },
      data: {
        lockedById: session.user.id,
        lockedByName: session.user.name ?? null,
        lockedByEmail: session.user.email ?? null,
        acquiredAt: mine ? existing.acquiredAt : new Date(),
        lastHeartbeat: new Date(),
      },
    });
    return { locked: true, byMe: true };
  }

  await prisma.contentLock.create({
    data: {
      contentType,
      contentId,
      lockedById: session.user.id,
      lockedByName: session.user.name ?? null,
      lockedByEmail: session.user.email ?? null,
    },
  });
  return { locked: true, byMe: true };
}

// Explicit "Take Over" action — unlike acquireLock, this claims the lock
// even if someone else's heartbeat is still fresh. The UI only exposes this
// after showing the current holder's name, so it's an informed decision,
// not a silent steal.
export async function takeOverLock(contentType: ContentKind, contentId: string): Promise<LockStatus> {
  const session = await requireSession();
  await prisma.contentLock.upsert({
    where: { contentType_contentId: { contentType, contentId } },
    create: {
      contentType,
      contentId,
      lockedById: session.user.id,
      lockedByName: session.user.name ?? null,
      lockedByEmail: session.user.email ?? null,
    },
    update: {
      lockedById: session.user.id,
      lockedByName: session.user.name ?? null,
      lockedByEmail: session.user.email ?? null,
      acquiredAt: new Date(),
      lastHeartbeat: new Date(),
    },
  });
  return { locked: true, byMe: true };
}

// Keeps a held lock alive. If it was reclaimed by someone else (or taken
// over) between heartbeats, this reports that instead of overwriting them.
export async function heartbeatLock(contentType: ContentKind, contentId: string): Promise<LockStatus> {
  const session = await requireSession();
  const existing = await prisma.contentLock.findUnique({
    where: { contentType_contentId: { contentType, contentId } },
  });

  if (!existing) {
    return acquireLock(contentType, contentId);
  }
  if (existing.lockedById !== session.user.id) {
    if (isExpired(existing.lastHeartbeat)) {
      return acquireLock(contentType, contentId);
    }
    return {
      locked: true,
      byMe: false,
      lockedByName: existing.lockedByName,
      lockedByEmail: existing.lockedByEmail,
      acquiredAt: existing.acquiredAt,
    };
  }

  await prisma.contentLock.update({
    where: { contentType_contentId: { contentType, contentId } },
    data: { lastHeartbeat: new Date() },
  });
  return { locked: true, byMe: true };
}

// Read-only check for bulk/background operations (e.g. CSV/JSON import)
// that must never silently overwrite a row someone else currently has open
// for editing. Unlike acquireLock/heartbeatLock, this never claims or
// modifies the lock — it only reports whether one is live.
export async function isLockedByOther(
  contentType: ContentKind,
  contentId: string,
  actingUserId: string
): Promise<{ locked: boolean; lockedByName: string | null }> {
  const existing = await prisma.contentLock.findUnique({
    where: { contentType_contentId: { contentType, contentId } },
  });
  if (!existing || existing.lockedById === actingUserId || isExpired(existing.lastHeartbeat)) {
    return { locked: false, lockedByName: null };
  }
  return { locked: true, lockedByName: existing.lockedByName };
}

// Best-effort — called on clean unmount/navigation. A tab that just closes
// won't fire this; the TTL above is what actually reclaims it either way.
export async function releaseLock(contentType: ContentKind, contentId: string): Promise<void> {
  const session = await requireSession();
  await prisma.contentLock.deleteMany({
    where: { contentType, contentId, lockedById: session.user.id },
  });
}
