import prisma from "@/lib/prisma";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import type { ContentType } from "@prisma/client";

// Only the actual editable content — never status, publishedAt, or the
// approval-assignment fields (reviewerId/seoReviewerId/approverId/
// reviewDeadline). Those are workflow state, not content, and already have
// their own history in ApprovalHistory; restoring an old content version
// must never silently rewind who's reviewing it or where it is in the
// pipeline.
const SNAPSHOT_FIELDS: Record<ContentType, string[]> = {
  POST: [
    "title", "slug", "content", "excerpt", "featuredImage", "featuredImageAlt",
    "metaTitle", "metaDescription", "focusKeyword", "canonicalUrl", "twitterCard",
    "ogImage", "ogTitle", "ogDescription", "twitterTitle", "twitterDescription", "twitterImage",
    "schemaJson", "isIndexable",
  ],
  PAGE: [
    "title", "slug", "content",
    "metaTitle", "metaDescription", "focusKeyword", "canonicalUrl", "twitterCard",
    "ogImage", "ogTitle", "ogDescription", "twitterTitle", "twitterDescription", "twitterImage",
    "schemaJson", "isIndexable",
  ],
  CASE_STUDY: [
    "title", "slug", "clientName", "industry", "serviceType", "results", "content", "excerpt",
    "websiteUrl", "featuredImage", "featuredImageAlt", "imageGallery", "isFeatured",
    "metaTitle", "metaDescription", "focusKeyword", "canonicalUrl", "twitterCard",
    "ogImage", "ogTitle", "ogDescription", "twitterTitle", "twitterDescription", "twitterImage",
    "schemaJson", "isIndexable",
  ],
};

// Post and CaseStudy also have a categories/tags many-to-many that doesn't
// live as a scalar field — captured/restored separately as id arrays.
const RELATION_TYPES: ContentType[] = ["POST", "CASE_STUDY"];

const MODEL_PATH: Record<ContentType, string> = {
  POST: "post",
  PAGE: "page",
  CASE_STUDY: "caseStudy",
};

type AnyRecord = Record<string, unknown>;
type Delegate = {
  findUnique(args: { where: { id: string }; include?: AnyRecord }): Promise<AnyRecord | null>;
  update(args: { where: { id: string }; data: AnyRecord }): Promise<{ id: string; slug: string }>;
};

function model(contentType: ContentType): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[MODEL_PATH[contentType]];
}

function buildSnapshot(contentType: ContentType, record: AnyRecord): AnyRecord {
  const snapshot: AnyRecord = {};
  for (const field of SNAPSHOT_FIELDS[contentType]) {
    snapshot[field] = record[field];
  }
  if (RELATION_TYPES.includes(contentType)) {
    snapshot.categoryIds = ((record.categories as { id: string }[]) || []).map((c) => c.id);
    snapshot.tagIds = ((record.tags as { id: string }[]) || []).map((t) => t.id);
  }
  return snapshot;
}

// Called by createPost/updatePost (and the Page/CaseStudy equivalents)
// right after their own mutation succeeds. `record` should include
// categories/tags if contentType is POST or CASE_STUDY.
export async function recordVersion(
  contentType: ContentType,
  contentId: string,
  record: AnyRecord,
  actor: { id: string; name: string | null; email: string | null },
  changeSummary?: string | null
) {
  const last = await prisma.contentVersion.findFirst({
    where: { contentType, contentId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  return prisma.contentVersion.create({
    data: {
      contentType,
      contentId,
      versionNumber,
      snapshot: JSON.stringify(buildSnapshot(contentType, record)),
      changeSummary: changeSummary?.trim() || null,
      authorId: actor.id,
      authorName: actor.name,
      authorEmail: actor.email,
    },
  });
}

export async function getVersionHistory(contentType: ContentType, contentId: string) {
  try {
    await requireSession();
    return await prisma.contentVersion.findMany({
      where: { contentType, contentId },
      orderBy: { versionNumber: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch version history:", error);
    return [];
  }
}

export async function compareVersions(contentType: ContentType, contentId: string, versionA: number, versionB: number) {
  try {
    await requireSession();
    const [a, b] = await Promise.all([
      prisma.contentVersion.findUnique({ where: { contentType_contentId_versionNumber: { contentType, contentId, versionNumber: versionA } } }),
      prisma.contentVersion.findUnique({ where: { contentType_contentId_versionNumber: { contentType, contentId, versionNumber: versionB } } }),
    ]);
    return {
      a: a ? { versionNumber: a.versionNumber, snapshot: JSON.parse(a.snapshot), createdAt: a.createdAt, authorName: a.authorName } : null,
      b: b ? { versionNumber: b.versionNumber, snapshot: JSON.parse(b.snapshot), createdAt: b.createdAt, authorName: b.authorName } : null,
    };
  } catch (error) {
    console.error("Failed to compare versions:", error);
    return { a: null, b: null };
  }
}

const REVALIDATE_PATHS: Record<ContentType, (slug: string, id: string) => string[]> = {
  POST: (slug, id) => ["/admin/posts", `/admin/posts/${id}`, "/blog", `/blog/${slug}`],
  PAGE: (slug, id) => ["/admin/pages", `/admin/pages/${id}`, `/${slug}`],
  CASE_STUDY: (slug, id) => ["/admin/case-studies", `/admin/case-studies/${id}`, "/case-studies", `/case-studies/${slug}`],
};

// Restoring NEVER overwrites or deletes any existing ContentVersion row. It
// applies the target version's snapshot to the live record, then records
// that as yet another brand new version on top — so "restore" reads the
// same in the history list as any other edit, and the version you restored
// FROM is still sitting there untouched for later reference.
export async function restoreVersion(contentType: ContentType, contentId: string, versionNumber: number) {
  try {
    const session = await requirePermission("EDIT");
    const version = await prisma.contentVersion.findUnique({
      where: { contentType_contentId_versionNumber: { contentType, contentId, versionNumber } },
    });
    if (!version) {
      return { success: false, error: "Version not found" };
    }

    const snapshot = JSON.parse(version.snapshot) as AnyRecord;
    const { categoryIds, tagIds, ...scalarFields } = snapshot;

    const updateData: AnyRecord = { ...scalarFields };
    if (RELATION_TYPES.includes(contentType)) {
      if (Array.isArray(categoryIds)) {
        updateData.categories = { set: (categoryIds as string[]).map((id) => ({ id })) };
      }
      if (Array.isArray(tagIds)) {
        updateData.tags = { set: (tagIds as string[]).map((id) => ({ id })) };
      }
    }

    const delegate = model(contentType);
    const updated = await delegate.update({ where: { id: contentId }, data: updateData });

    const includeRelations = RELATION_TYPES.includes(contentType) ? { include: { categories: true, tags: true } } : {};
    const full = await delegate.findUnique({ where: { id: contentId }, ...includeRelations });

    await recordVersion(
      contentType,
      contentId,
      full || scalarFields,
      { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      `Restored from version ${versionNumber}`
    );

    for (const path of REVALIDATE_PATHS[contentType](updated.slug, contentId)) {
      revalidatePath(path);
    }

    await logAudit({
      action: "restore",
      category: "Content",
      entityType: contentType === "CASE_STUDY" ? "CaseStudy" : contentType === "PAGE" ? "Page" : "Post",
      entityId: contentId,
      entityLabel: updated.slug,
      after: { restoredFromVersion: versionNumber },
    });

    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) {
      return { success: false, error: error.message };
    }
    console.error(`Failed to restore version ${versionNumber} for ${contentType}:${contentId}:`, error);
    return { success: false, error: "Failed to restore version" };
  }
}
