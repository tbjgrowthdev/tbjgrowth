import type { ContentPipelineRun } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { searchContent } from "@/lib/content-search";
import { sanitizeRichText } from "@/lib/sanitize";
import { fetchSearchVolume, fetchSerpOverview } from "@/lib/seo-services";
import { callAiForJson } from "./ai";
import { completeJob, failJob, startOrResumeJob } from "./jobs";
import { getForbiddenTerms } from "@/lib/brand-kb/context";
import { retrieveApprovedSources } from "@/lib/rag/retrieve";
import {
  buildDraftPrompt,
  buildInternalLinksPrompt,
  buildOutlinePrompt,
  buildQaPrompt,
  buildResearchPrompt,
  buildSchemaPrompt,
  buildSearchIntentPrompt,
  buildSeoPrompt,
} from "./prompts";
import type {
  AppliedInternalLink,
  Brief,
  Outline,
  PipelineContentType,
  QaReport,
  Research,
  SchemaNotes,
  SearchIntent,
} from "./types";

type StageResult<T = ContentPipelineRun | null> = { success: true; data: T } | { success: false; error: string };

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function getRunOrThrow(id: string) {
  const run = await prisma.contentPipelineRun.findUnique({ where: { id } });
  if (!run) throw new Error("Pipeline run not found");
  return run;
}

function wrongStage(error: string): StageResult {
  return { success: false, error };
}

// ------------------------------------------------------
// Create / read / delete runs
// ------------------------------------------------------

export async function createPipelineRun(brief: Brief): Promise<StageResult> {
  try {
    const session = await requirePermission("CREATE");
    if (!brief.topic?.trim() || !brief.goal?.trim() || !brief.audience?.trim()) {
      return wrongStage("Topic, goal, and audience are required");
    }
    if (brief.contentType === "CASE_STUDY" && (!brief.clientName?.trim() || !brief.industry?.trim() || !brief.serviceType?.trim())) {
      return wrongStage("Client name, industry, and service type are required for a case study");
    }

    const run = await prisma.contentPipelineRun.create({
      data: {
        contentType: brief.contentType,
        stage: "BRIEF",
        brief: JSON.stringify(brief),
        createdById: session.user.id,
      },
    });
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "ContentPipelineRun",
      entityId: run.id,
      entityLabel: brief.topic,
      after: { contentType: brief.contentType, topic: brief.topic },
    });
    revalidatePath("/admin/ai-pipeline");
    return { success: true, data: run };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error("Failed to create pipeline run:", error);
    return wrongStage("Failed to create pipeline run");
  }
}

export async function getPipelineRuns() {
  try {
    await requirePermission("CREATE");
    return await prisma.contentPipelineRun.findMany({
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch pipeline runs:", error);
    return [];
  }
}

export async function getPipelineRun(id: string) {
  try {
    await requirePermission("CREATE");
    const run = await prisma.contentPipelineRun.findUnique({
      where: { id },
      include: { createdBy: { select: { name: true, email: true } } },
    });
    if (!run) return null;
    const content =
      run.contentId && run.contentType === "POST"
        ? await prisma.post.findUnique({ where: { id: run.contentId } })
        : run.contentId && run.contentType === "CASE_STUDY"
        ? await prisma.caseStudy.findUnique({ where: { id: run.contentId } })
        : null;
    return { run, content };
  } catch (error) {
    console.error("Failed to fetch pipeline run:", error);
    return null;
  }
}

export async function deletePipelineRun(id: string): Promise<StageResult> {
  try {
    await requirePermission("CREATE");
    const run = await getRunOrThrow(id);
    if (run.contentId) {
      return wrongStage("This run already has published/draft content attached — delete the content itself from its own list instead");
    }
    await prisma.contentPipelineRun.delete({ where: { id } });
    revalidatePath("/admin/ai-pipeline");
    return { success: true, data: null };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error("Failed to delete pipeline run:", error);
    return wrongStage("Failed to delete pipeline run");
  }
}

// ------------------------------------------------------
// Content-row read/patch helpers (Draft stage onward) — every stage after
// Draft reads the CURRENT full row and writes back the complete payload
// updatePost/updateCaseStudy expect; those actions don't support partial
// field updates (an omitted content/title/slug would be overwritten with
// an empty value), so patching one field always means "fetch, spread,
// override, save" rather than sending just the changed key.
// ------------------------------------------------------

async function getContentRecord(contentType: PipelineContentType, id: string) {
  return contentType === "POST"
    ? prisma.post.findUnique({ where: { id }, include: { categories: true, tags: true } })
    : prisma.caseStudy.findUnique({ where: { id } });
}

async function patchContent(contentType: PipelineContentType, id: string, patch: Record<string, unknown>) {
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

function publicUrlFor(contentType: PipelineContentType, slug: string): string {
  return contentType === "POST" ? `/blog/${slug}` : `/case-studies/${slug}`;
}

// ------------------------------------------------------
// Stage 2: Search Intent
// ------------------------------------------------------

export async function runSearchIntentStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "BRIEF") return wrongStage(`Expected stage BRIEF, run is at ${run.stage}`);
    const brief = parseJson<Brief>(run.brief);
    if (!brief) return wrongStage("Could not read this run's brief");

    const job = await startOrResumeJob(runId, "SEARCH_INTENT", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const prompt = await buildSearchIntentPrompt(brief);
      const { data: raw, usage } = await callAiForJson<{ intentType: string; rationale: string; primaryKeyword: string; secondaryKeywords: string[] }>(
        prompt.system,
        prompt.user
      );

      const allKeywords = [raw.primaryKeyword, ...raw.secondaryKeywords];
      const volumes = await fetchSearchVolume(allKeywords);
      const volumeByKeyword = new Map((volumes ?? []).map((v) => [v.keyword.toLowerCase(), v]));

      const searchIntent: SearchIntent = {
        intentType: raw.intentType as SearchIntent["intentType"],
        rationale: raw.rationale,
        primaryKeyword: raw.primaryKeyword,
        secondaryKeywords: raw.secondaryKeywords.map((keyword) => {
          const v = volumeByKeyword.get(keyword.toLowerCase());
          return { keyword, searchVolume: v?.searchVolume ?? null, competition: v?.competition ?? null, cpc: v?.cpc ?? null };
        }),
      };

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "SEARCH_INTENT", searchIntent: JSON.stringify(searchIntent) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Search Intent stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Search Intent stage failed");
  }
}

// ------------------------------------------------------
// Stage 3: Research
// ------------------------------------------------------

export async function runResearchStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SEARCH_INTENT") return wrongStage(`Expected stage SEARCH_INTENT, run is at ${run.stage}`);
    const brief = parseJson<Brief>(run.brief);
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    if (!brief || !searchIntent) return wrongStage("Could not read this run's brief/search intent");

    const job = await startOrResumeJob(runId, "RESEARCH", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const retrievedSources = await retrieveApprovedSources(`${brief.topic} ${searchIntent.primaryKeyword}`);
      const serpOverview = await fetchSerpOverview(searchIntent.primaryKeyword);
      const prompt = await buildResearchPrompt(brief, searchIntent, serpOverview, retrievedSources);
      const { data: modelOutput, usage } = await callAiForJson<Omit<Research, "retrievedSources">>(prompt.system, prompt.user);
      const research: Research = { ...modelOutput, retrievedSources };

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "RESEARCH", research: JSON.stringify(research) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Research stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Research stage failed");
  }
}

// ------------------------------------------------------
// Stage 4: Outline
// ------------------------------------------------------

export async function runOutlineStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "RESEARCH") return wrongStage(`Expected stage RESEARCH, run is at ${run.stage}`);
    const brief = parseJson<Brief>(run.brief);
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    const research = parseJson<Research>(run.research);
    if (!brief || !searchIntent || !research) return wrongStage("Could not read this run's prior stages");

    const job = await startOrResumeJob(runId, "OUTLINE", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const prompt = await buildOutlinePrompt(brief, searchIntent, research);
      const { data: outline, usage } = await callAiForJson<Outline>(prompt.system, prompt.user);

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "OUTLINE", outline: JSON.stringify(outline) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Outline stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Outline stage failed");
  }
}

// ------------------------------------------------------
// Stage 5: Draft — this is the one stage that creates the real
// Post/CaseStudy row (via the existing createPost/createCaseStudy actions,
// so authorship, versioning, and the audit log all happen exactly the same
// way they would for a hand-written draft).
// ------------------------------------------------------

export async function runDraftStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("CREATE");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "OUTLINE") return wrongStage(`Expected stage OUTLINE, run is at ${run.stage}`);
    if (run.contentId) return wrongStage("This run already has a draft");
    const brief = parseJson<Brief>(run.brief);
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    const research = parseJson<Research>(run.research);
    const outline = parseJson<Outline>(run.outline);
    if (!brief || !searchIntent || !research || !outline) return wrongStage("Could not read this run's prior stages");

    const job = await startOrResumeJob(runId, "DRAFT", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const prompt = await buildDraftPrompt(brief, searchIntent, research, outline);
      const { data: draftData, usage } = await callAiForJson<{ contentHtml: string }>(prompt.system, prompt.user, 8192);
      const { contentHtml } = draftData;

      const basePayload = {
        title: outline.title,
        content: contentHtml,
        excerpt: outline.excerpt,
        focusKeyword: searchIntent.primaryKeyword,
      };

      let contentId: string;
      if (run.contentType === "POST") {
        const { createPost } = await import("@/app/(admin)/actions/posts");
        const result = await createPost(basePayload);
        if (!result.success || !result.data) throw new Error(result.error || "Failed to create the draft post");
        contentId = result.data.id;
      } else {
        const { createCaseStudy } = await import("@/app/(admin)/actions/cases");
        const result = await createCaseStudy({
          ...basePayload,
          clientName: brief.clientName,
          industry: brief.industry,
          serviceType: brief.serviceType,
          results: brief.resultsHint,
        });
        if (!result.success || !result.data) throw new Error(result.error || "Failed to create the draft case study");
        contentId = result.data.id;
      }

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "DRAFT", contentId },
      });
      await completeJob(job.id, { contentId, usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Draft stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Draft stage failed");
  }
}

// ------------------------------------------------------
// Stage 6: SEO — patches the real content row's SEO fields
// ------------------------------------------------------

export async function runSeoStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "DRAFT") return wrongStage(`Expected stage DRAFT, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    if (!searchIntent) return wrongStage("Could not read this run's search intent");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    const job = await startOrResumeJob(runId, "SEO", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const prompt = await buildSeoPrompt(content.title, content.excerpt || "", content.content, searchIntent.primaryKeyword);
      const { data: seo, usage } = await callAiForJson<{
        metaTitle: string;
        metaDescription: string;
        ogTitle: string;
        ogDescription: string;
        twitterTitle: string;
        twitterDescription: string;
      }>(prompt.system, prompt.user);

      const patchResult = await patchContent(run.contentType as PipelineContentType, run.contentId, {
        ...seo,
        twitterCard: "summary_large_image",
      });
      if (!patchResult.success) throw new Error(patchResult.error || "Failed to save SEO fields");

      const updated = await prisma.contentPipelineRun.update({ where: { id: runId }, data: { stage: "SEO" } });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`SEO stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "SEO stage failed");
  }
}

// ------------------------------------------------------
// Stage 7: Internal Links — AI picks anchors verbatim from the existing
// content string; the server does the actual insertion via exact-substring
// replacement (never trusts the model to hand back safely-rewritten HTML).
// ------------------------------------------------------

export async function runInternalLinksStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SEO") return wrongStage(`Expected stage SEO, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    const job = await startOrResumeJob(runId, "INTERNAL_LINKS", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const allItems = await searchContent({});
      const candidates = allItems
        .filter((i) => i.id !== run.contentId)
        .filter((i) => (i.status ? i.status === "PUBLISHED" : i.isIndexable))
        .filter((i) => i.slug)
        .slice(0, 40)
        .map((i) => ({
          title: i.title,
          url:
            i.type === "POST" ? `/blog/${i.slug}` : i.type === "CASE_STUDY" ? `/case-studies/${i.slug}` : i.type === "SERVICE" ? `/services/${i.slug}` : `/${i.slug}`,
          excerpt: i.metaDescription || i.title,
        }));

      const prompt = await buildInternalLinksPrompt(content.content, candidates);
      const { data: linksData, usage } = await callAiForJson<{ links: { anchorText: string; targetUrl: string; targetTitle: string; reason: string }[] }>(
        prompt.system,
        prompt.user
      );
      const { links } = linksData;

      let html = content.content;
      const applied: AppliedInternalLink[] = [];
      const usedUrls = new Set<string>();
      for (const link of links) {
        if (usedUrls.has(link.targetUrl) || !candidates.some((c) => c.url === link.targetUrl)) {
          applied.push({ anchorText: link.anchorText, targetUrl: link.targetUrl, targetTitle: link.targetTitle, applied: false, reason: "Invalid or duplicate target URL" });
          continue;
        }
        if (!html.includes(link.anchorText)) {
          applied.push({ anchorText: link.anchorText, targetUrl: link.targetUrl, targetTitle: link.targetTitle, applied: false, reason: "Anchor text not found verbatim in content" });
          continue;
        }
        html = html.replace(link.anchorText, `<a href="${link.targetUrl}">${link.anchorText}</a>`);
        usedUrls.add(link.targetUrl);
        applied.push({ anchorText: link.anchorText, targetUrl: link.targetUrl, targetTitle: link.targetTitle, applied: true });
      }

      const patchResult = await patchContent(run.contentType as PipelineContentType, run.contentId, { content: sanitizeRichText(html) });
      if (!patchResult.success) throw new Error(patchResult.error || "Failed to save internal links");

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "INTERNAL_LINKS", internalLinks: JSON.stringify(applied) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Internal Links stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Internal Links stage failed");
  }
}

// ------------------------------------------------------
// Stage 8: Schema
// ------------------------------------------------------

export async function runSchemaStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "INTERNAL_LINKS") return wrongStage(`Expected stage INTERNAL_LINKS, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    const job = await startOrResumeJob(runId, "SCHEMA", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";
      const schemaType = run.contentType === "POST" ? "BlogPosting" : "Article";
      const prompt = await buildSchemaPrompt({
        schemaType,
        title: content.title,
        description: content.metaDescription || content.excerpt || "",
        canonicalUrl: `${baseUrl}${publicUrlFor(run.contentType as PipelineContentType, content.slug)}`,
        authorName: "TBJ Growth",
        datePublished: content.createdAt.toISOString(),
        imageUrl: content.featuredImage,
      });
      const { data: schemaData, usage } = await callAiForJson<{ schema: Record<string, unknown> }>(prompt.system, prompt.user);
      const { schema } = schemaData;

      if (!schema || schema["@context"] !== "https://schema.org" || !schema["@type"]) {
        throw new Error("The AI provider returned an invalid schema.org object");
      }

      const patchResult = await patchContent(run.contentType as PipelineContentType, run.contentId, { schemaJson: JSON.stringify(schema) });
      if (!patchResult.success) throw new Error(patchResult.error || "Failed to save schema");

      const schemaNotes: SchemaNotes = { schemaType };
      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "SCHEMA", schemaNotes: JSON.stringify(schemaNotes) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Schema stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Schema stage failed");
  }
}

// ------------------------------------------------------
// Stage 9: QA — a handful of objective checks computed here (character
// counts, keyword presence) plus the model's own qualitative review.
// Advisory, not a hard gate: a failed check is surfaced to the human
// approver, not blocked automatically — only a person signs off on
// publishing, per the explicit Human Approval step.
// ------------------------------------------------------

export async function runQaStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SCHEMA") return wrongStage(`Expected stage SCHEMA, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    if (!searchIntent) return wrongStage("Could not read this run's search intent");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    const job = await startOrResumeJob(runId, "QA", run.contentId);
    if (job.alreadyCompleted) return { success: true, data: run };

    try {
      const plainText = content.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const wordCount = plainText ? plainText.split(" ").length : 0;
      const keywordLower = searchIntent.primaryKeyword.toLowerCase();
      const plainTextLower = plainText.toLowerCase();

      const forbiddenTerms = await getForbiddenTerms();
      const foundForbiddenTerms = forbiddenTerms.filter((term) => plainTextLower.includes(term.toLowerCase()));

      const objectiveChecks = [
        { label: "Meta title is 60 characters or fewer", passed: (content.metaTitle?.length ?? 0) > 0 && (content.metaTitle?.length ?? 0) <= 60 },
        { label: "Meta description is 160 characters or fewer", passed: (content.metaDescription?.length ?? 0) > 0 && (content.metaDescription?.length ?? 0) <= 160 },
        { label: "Focus keyword appears in the content", passed: plainTextLower.includes(keywordLower) },
        { label: "Focus keyword appears in the meta title", passed: (content.metaTitle ?? "").toLowerCase().includes(keywordLower) },
        { label: "Content is at least 600 words", passed: wordCount >= 600 },
        { label: "Schema.org structured data is present", passed: Boolean(content.schemaJson) },
        ...(forbiddenTerms.length > 0
          ? [{ label: "No forbidden terms from the Brand Knowledge Base", passed: foundForbiddenTerms.length === 0, note: foundForbiddenTerms.length > 0 ? `Found: ${foundForbiddenTerms.join(", ")}` : undefined }]
          : []),
      ];

      const prompt = await buildQaPrompt(content.title, content.metaTitle || "", content.metaDescription || "", content.content, searchIntent.primaryKeyword);
      const { data: aiReview, usage } = await callAiForJson<{ checks: { label: string; passed: boolean; note?: string }[]; summary: string }>(prompt.system, prompt.user);

      const allChecks = [...objectiveChecks, ...aiReview.checks];
      const qaReport: QaReport = {
        overallPassed: allChecks.every((c) => c.passed),
        wordCount,
        checks: allChecks,
        summary: aiReview.summary,
      };

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { stage: "QA", qaReport: JSON.stringify(qaReport) },
      });
      await completeJob(job.id, { usage });
      revalidatePath(`/admin/ai-pipeline/${runId}`);
      return { success: true, data: updated };
    } catch (stageError: any) {
      await failJob(job.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`QA stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "QA stage failed");
  }
}

// ------------------------------------------------------
// Stage 10: Human Approval — a deliberate manual gate, not an AI call.
// Recorded on the run itself; the actual publish-permission check still
// happens for real in the Publish stage via transitionContent, so approving
// here never bypasses PUBLISH/CREATE permission checks.
// ------------------------------------------------------

export async function approveRunForPublish(runId: string): Promise<StageResult> {
  try {
    const session = await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "QA") return wrongStage(`Expected stage QA, run is at ${run.stage}`);

    const updated = await prisma.contentPipelineRun.update({
      where: { id: runId },
      data: { stage: "APPROVAL", approvedAt: new Date(), approvedById: session.user.id },
    });
    await logAudit({
      action: "approve",
      category: "Approval",
      entityType: "ContentPipelineRun",
      entityId: runId,
      entityLabel: run.contentId ?? runId,
    });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Human approval failed for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to record approval");
  }
}

// ------------------------------------------------------
// Stage 11: Publish — reuses the exact same workflow transitions/scheduling
// the rest of the CMS uses, so this never becomes a second, parallel
// publish path with its own rules.
// ------------------------------------------------------

export async function publishRun(
  runId: string,
  mode: "publish" | "submit" | "schedule",
  schedule?: { date: string; time: string; timezone: string }
): Promise<StageResult> {
  try {
    const run = await getRunOrThrow(runId);
    if (run.stage !== "APPROVAL") return wrongStage(`Expected stage APPROVAL, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no content to publish");

    const { transitionContent } = await import("@/lib/workflow");
    if (mode === "submit") {
      const result = await transitionContent(run.contentType, run.contentId, "submit");
      if (!result.success) return wrongStage(result.error || "Failed to submit for review");
    } else if (mode === "schedule") {
      if (!schedule) return wrongStage("A schedule date/time is required");
      const { scheduleContentJob } = await import("@/app/(admin)/actions/scheduling");
      const scheduleResult = await transitionContent(run.contentType, run.contentId, "schedule");
      if (!scheduleResult.success) return wrongStage(scheduleResult.error || "Failed to schedule");
      const jobResult = await scheduleContentJob(run.contentType, run.contentId, "PUBLISH", schedule.date, schedule.time, schedule.timezone);
      if (!jobResult.success) {
        await transitionContent(run.contentType, run.contentId, "unpublish").catch(() => {});
        return wrongStage(jobResult.error || "Failed to schedule");
      }
    } else {
      const result = await transitionContent(run.contentType, run.contentId, "publish");
      if (!result.success) return wrongStage(result.error || "Failed to publish");
    }

    const updated = await prisma.contentPipelineRun.update({ where: { id: runId }, data: { stage: "PUBLISHED" } });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    revalidatePath("/admin/ai-pipeline");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error(`Publish stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Publish stage failed");
  }
}
