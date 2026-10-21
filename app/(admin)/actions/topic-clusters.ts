"use server";

import { requirePermission, AuthError } from "@/lib/auth-guard";
import { buildTopicClusters } from "@/lib/topic-clusters/build";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function getTopicClustersAction(): Promise<ActionResult<Awaited<ReturnType<typeof buildTopicClusters>>>> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const clusters = await buildTopicClusters();
    return { success: true, data: clusters };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to build topic clusters:", error);
    return { success: false, error: "Failed to build topic clusters" };
  }
}
