"use server";

import { findDependencies, type ContentKind } from "@/lib/dependency-check";
import { requireSession } from "@/lib/auth-guard";

// Read-only diagnostic shown right before an already-permitted delete — the
// delete action itself still enforces DELETE permission separately. A
// session is enough to see this; it doesn't need its own extra gate.
export async function checkContentDependencies(kind: ContentKind, id: string) {
  try {
    await requireSession();
    return await findDependencies(kind, id);
  } catch (error) {
    console.error(`Failed to check dependencies for ${kind}:${id}:`, error);
    return [];
  }
}
