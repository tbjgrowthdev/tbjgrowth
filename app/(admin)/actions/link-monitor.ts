"use server";

import { runLinkCheck, getLatestLinkCheckRun, getLinkCheckHistory } from "@/lib/link-monitor";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";

export async function getLinkMonitorData() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const [latest, history] = await Promise.all([getLatestLinkCheckRun(), getLinkCheckHistory()]);
    return { latest, history };
  } catch (error) {
    console.error("Failed to fetch link monitor data:", error);
    return { latest: null, history: [] };
  }
}

export async function runLinkCheckNow() {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const run = await runLinkCheck("manual");
    revalidatePath("/admin/link-monitor");
    return { success: true, run };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to run link check:", error);
    return { success: false, error: "Scan failed — see server logs" };
  }
}
