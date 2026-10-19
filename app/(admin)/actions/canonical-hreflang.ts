"use server";

import { requirePermission, AuthError } from "@/lib/auth-guard";
import { scanCanonicalAndHreflang, type CanonicalHreflangReport } from "@/lib/canonical-hreflang";

type StageResult<T> = { success: true; data: T } | { success: false; error: string };

// No persisted table and no cron for this one, unlike Content Health Score/
// Recommendations/Cannibalization — those call GA4/GSC (slow, rate-limited,
// worth caching as a snapshot). This scan only reads the DB and does plain
// URL parsing, so it's cheap enough to run live on every page visit; a
// "Scan Now" button just re-runs it.
export async function getCanonicalHreflangReport(): Promise<StageResult<CanonicalHreflangReport>> {
  try {
    await requirePermission("EDIT");
    const report = await scanCanonicalAndHreflang();
    return { success: true, data: report };
  } catch (error: any) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Canonical/hreflang scan failed:", error);
    return { success: false, error: "Scan failed" };
  }
}
