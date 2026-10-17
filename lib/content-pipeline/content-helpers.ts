import { prisma } from "@/lib/prisma";
import type { PipelineContentType } from "./types";

// Shared by lib/content-pipeline/stages.ts and lib/content-refresh/refresh.ts
// — both patch an existing Post/CaseStudy row through the normal
// updatePost/updateCaseStudy actions rather than writing Prisma directly,
// so authorship/versioning/audit-log/stale-check all behave exactly like a
// hand-edited save.
export async function getContentRecord(contentType: PipelineContentType, id: string) {
  return contentType === "POST"
    ? prisma.post.findUnique({ where: { id }, include: { categories: true, tags: true } })
    : prisma.caseStudy.findUnique({ where: { id } });
}

// updatePost/updateCaseStudy don't support partial updates (an omitted
// content/title/slug would be overwritten with an empty value), so
// patching one field always means "fetch the full current row, spread,
// override, save" rather than sending just the changed key.
export async function patchContent(contentType: PipelineContentType, id: string, patch: Record<string, unknown>) {
  const current = await getContentRecord(contentType, id);
  if (!current) return { success: false, error: "Content record not found" };
  const payload: Record<string, unknown> = { ...current, ...patch, expectedUpdatedAt: current.updatedAt };
  if (contentType === "POST") {
    const { updatePost } = await import("@/app/(admin)/actions/posts");
    return updatePost(id, payload);
  }
  const { updateCaseStudy } = await import("@/app/(admin)/actions/cases");
  return updateCaseStudy(id, payload);
}

export function publicUrlFor(contentType: PipelineContentType, slug: string): string {
  return contentType === "POST" ? `/blog/${slug}` : `/case-studies/${slug}`;
}
