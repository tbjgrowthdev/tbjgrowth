"use server";

import { requirePermission, AuthError } from "@/lib/auth-guard";
import { buildInternalLinkGraph } from "@/lib/link-graph/build";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function getInternalLinkGraphAction(): Promise<ActionResult<Awaited<ReturnType<typeof buildInternalLinkGraph>>>> {
  try {
    await requirePermission("SEO_MANAGEMENT");
    const graph = await buildInternalLinkGraph();
    return { success: true, data: graph };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to build internal link graph:", error);
    return { success: false, error: "Failed to build link graph" };
  }
}
