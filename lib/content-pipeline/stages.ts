import type { ContentPipelineRun } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, AuthError } from "@/lib/auth-guard";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { searchContent } from "@/lib/content-search";
import { sanitizeRichText } from "@/lib/sanitize";
import { fetchSearchVolume, fetchSerpOverview } from "@/lib/seo-services";
import { callAiForJson } from "./ai";
import { completeJob, createImageJob, createTextJob, failJob, startOrResumeJob } from "./jobs";
import { getActiveImageProvider } from "./providers";
import { estimateImageCostUsd } from "./pricing";
import { getForbiddenTerms } from "@/lib/brand-kb/context";
import { retrieveApprovedSources } from "@/lib/rag/retrieve";
import { uploadAndRegisterGeneratedImage } from "@/lib/cloudinary";
import { checkAltText, checkDuplicateContent, checkLinks, checkMetadata, checkSchema, checkSeoHeadings } from "./quality-gate";
import { getContentRecord, patchContent, publicUrlFor } from "./content-helpers";
import {
  buildAltTextPrompt,
  buildDraftPrompt,
  buildImageGenerationPrompt,
  buildInternalLinksPrompt,
  buildOutlinePrompt,
  buildQaPrompt,
  buildResearchPrompt,
  buildSchemaPrompt,
  buildSearchIntentPrompt,
  buildSeoPrompt,
} from "./prompts";
import type {
  Brief,
  GeneratedImage,
  LinkSuggestion,
  LinkSuggestionStatus,
  Outline,
  PipelineContentType,
  QaCheck,
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
        // Carries the Search Intent stage's own secondary keyword picks
        // straight onto the real row — same JSON string[] shape the
        // Unified SEO Engine's SeoPanel reads/writes for manually-created
        // content, just populated automatically here instead of left for
        // an admin to type in by hand.
        secondaryKeywords: JSON.stringify(searchIntent.secondaryKeywords.map((k) => k.keyword)),
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
// Stage 5b: Image — Generate -> Store -> Optimize -> Generate alt text,
// landing on a pending, unapproved GeneratedImage. Deliberately does NOT
// use startOrResumeJob()'s idempotent pattern (see createImageJob's own
// comment): "Regenerate" must be able to run this as many times as a
// human wants before approving one result, so each call always does real
// work and creates a fresh Job ID rather than short-circuiting on a prior
// completed attempt. Nothing is attached to the real content row here —
// that only happens in attachGeneratedImage, a separate, explicit human
// action (see Stage 5c below).
// ------------------------------------------------------

export async function runImageStage(runId: string): Promise<StageResult> {
  try {
    const session = await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "DRAFT") return wrongStage(`Expected stage DRAFT, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const brief = parseJson<Brief>(run.brief);
    const outline = parseJson<Outline>(run.outline);
    if (!brief || !outline) return wrongStage("Could not read this run's prior stages");

    const imagePromptText = await buildImageGenerationPrompt(brief, outline);
    const imageProvider = getActiveImageProvider();

    // Generate + Store + Optimize, tracked as their own job — completed
    // (with real cost recorded) the moment the upload succeeds, before
    // alt-text generation even starts. Real money was spent calling the
    // image provider regardless of what happens next, so that cost must
    // never end up attributed to a "FAILED" job just because a later,
    // independent step (alt text) has a problem.
    const imageJob = await createImageJob(runId, run.contentId);
    let asset: { id: string };
    let url: string;
    try {
      const { data, mimeType } = await imageProvider.generateImage(imagePromptText);
      const uploaded = await uploadAndRegisterGeneratedImage(data, mimeType, {
        folder: "AI Generated",
        title: outline.title,
        uploadedBy: { id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? null },
      });
      asset = uploaded.asset;
      url = uploaded.url;
      await completeJob(imageJob.id, { flatCostUsd: estimateImageCostUsd(imageProvider.name, imageProvider.model) });
    } catch (stageError: any) {
      await failJob(imageJob.id, stageError?.message || String(stageError), stageError?.usage);
      throw stageError;
    }

    // Alt text, as its own job — a failure here doesn't throw the whole
    // stage out (the image itself is already safely stored): it falls
    // back to a plain, usable default so there's always something for the
    // human reviewer to approve or edit, never a blank/missing alt text.
    const altTextJob = await createImageJob(runId, run.contentId);
    let altText = outline.title;
    try {
      const altPrompt = await buildAltTextPrompt(outline, imagePromptText);
      const { data: altData, usage } = await callAiForJson<{ altText: string }>(altPrompt.system, altPrompt.user);
      altText = altData.altText;
      await completeJob(altTextJob.id, { usage });
    } catch (altError: any) {
      await failJob(altTextJob.id, altError?.message || String(altError), altError?.usage);
      // Deliberately not re-thrown — see comment above.
    }
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { altText } });

    const generatedImage: GeneratedImage = {
      mediaAssetId: asset.id,
      url,
      altText,
      provider: imageProvider.name,
      model: imageProvider.model,
      approved: false,
    };
    const updated = await prisma.contentPipelineRun.update({
      where: { id: runId },
      data: { generatedImage: JSON.stringify(generatedImage) },
    });

    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Image stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Image stage failed");
  }
}

// ------------------------------------------------------
// Stage 5c: Human review + attach — the explicit gate between "a human
// looked at the generated image/alt text" and it actually becoming the
// content's featuredImage/featuredImageAlt. Approving and attaching are
// the same action: there's no "approved but not yet attached" state.
// ------------------------------------------------------

// Part of review, not a separate stage: lets the human correct the
// AI-written (or fallback) alt text before approving, without having to
// regenerate the whole image over it. Updates both the run's pending
// record and the underlying MediaAsset, so they can never drift once
// attached.
export async function updatePendingImageAltText(runId: string, altText: string): Promise<StageResult> {
  const trimmed = altText.trim();
  if (!trimmed) return wrongStage("Alt text is required");
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    const generatedImage = parseJson<GeneratedImage>(run.generatedImage);
    if (!generatedImage) return wrongStage("No generated image to update yet");
    if (generatedImage.approved) return wrongStage("This image has already been attached");

    await prisma.mediaAsset.update({ where: { id: generatedImage.mediaAssetId }, data: { altText: trimmed } });
    const next: GeneratedImage = { ...generatedImage, altText: trimmed };
    const updated = await prisma.contentPipelineRun.update({ where: { id: runId }, data: { generatedImage: JSON.stringify(next) } });

    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Failed to update pending image alt text for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to update alt text");
  }
}

export async function attachGeneratedImage(runId: string): Promise<StageResult> {
  try {
    const session = await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "DRAFT") return wrongStage(`Expected stage DRAFT, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const generatedImage = parseJson<GeneratedImage>(run.generatedImage);
    if (!generatedImage) return wrongStage("No generated image to review yet");
    if (generatedImage.approved) return wrongStage("This image has already been attached");

    const patchResult = await patchContent(run.contentType as PipelineContentType, run.contentId, {
      featuredImage: generatedImage.url,
      featuredImageAlt: generatedImage.altText,
    });
    if (!patchResult.success) return wrongStage(patchResult.error || "Failed to attach the image to the content");

    const approved: GeneratedImage = { ...generatedImage, approved: true, approvedAt: new Date().toISOString(), approvedById: session.user.id };
    const updated = await prisma.contentPipelineRun.update({
      where: { id: runId },
      data: { stage: "IMAGE", generatedImage: JSON.stringify(approved) },
    });

    await logAudit({
      action: "approve",
      category: "Content",
      entityType: "ContentPipelineRun",
      entityId: runId,
      entityLabel: generatedImage.mediaAssetId,
      after: { mediaAssetId: generatedImage.mediaAssetId },
    });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Attach generated image failed for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to attach generated image");
  }
}

// Not every piece of content needs an AI-generated featured image — this
// advances past the Image stage without attaching one, leaving
// featuredImage exactly as it was (unset, or whatever the admin set
// manually via the full editor). Safe to call even after a pending,
// unapproved generatedImage exists — skipping just means that pending
// result is never attached; its MediaAsset row stays in the library,
// same as any other unused generated attempt.
export async function skipImageStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "DRAFT") return wrongStage(`Expected stage DRAFT, run is at ${run.stage}`);

    const updated = await prisma.contentPipelineRun.update({ where: { id: runId }, data: { stage: "IMAGE" } });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Skip image stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to skip image stage");
  }
}

// ------------------------------------------------------
// Stage 6: SEO — patches the real content row's SEO fields
// ------------------------------------------------------

export async function runSeoStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "IMAGE") return wrongStage(`Expected stage IMAGE, run is at ${run.stage}`);
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

// Generates suggestions and stores them pending review — does NOT apply
// anything or advance the stage. Same non-idempotent "fresh job every
// call" shape as the Image stage: calling this again (whether first
// "Generate" or a later "Regenerate") always does real work and discards
// whatever suggestion batch was there before, including any decisions
// already made on it.
export async function runInternalLinksStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SEO") return wrongStage(`Expected stage SEO, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    const job = await createTextJob(runId, "INTERNAL_LINKS", run.contentId);

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

      const usedUrls = new Set<string>();
      const suggestions: LinkSuggestion[] = linksData.links.map((link) => {
        let status: LinkSuggestionStatus = "pending";
        let invalidReason: string | undefined;
        if (usedUrls.has(link.targetUrl) || !candidates.some((c) => c.url === link.targetUrl)) {
          status = "invalid";
          invalidReason = "Invalid or duplicate target URL";
        } else if (!content.content.includes(link.anchorText)) {
          status = "invalid";
          invalidReason = "Anchor text not found verbatim in content";
        } else {
          usedUrls.add(link.targetUrl);
        }
        return {
          id: crypto.randomUUID(),
          sourceTitle: content.title,
          targetTitle: link.targetTitle,
          targetUrl: link.targetUrl,
          anchorText: link.anchorText,
          reason: link.reason,
          status,
          invalidReason,
          applied: false,
        };
      });

      const updated = await prisma.contentPipelineRun.update({
        where: { id: runId },
        data: { internalLinks: JSON.stringify(suggestions) },
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

// Human review, one suggestion at a time — see Stage 5c's attachGeneratedImage comment for the same "approve/reject is a decision, applying is separate" shape.
export async function decideLinkSuggestion(runId: string, suggestionId: string, decision: "approved" | "rejected"): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    const suggestions = parseJson<LinkSuggestion[]>(run.internalLinks);
    if (!suggestions) return wrongStage("No link suggestions to review yet");
    const target = suggestions.find((s) => s.id === suggestionId);
    if (!target) return wrongStage("Suggestion not found");
    if (target.status !== "pending") return wrongStage("This suggestion has already been decided");

    target.status = decision;
    const updated = await prisma.contentPipelineRun.update({ where: { id: runId }, data: { internalLinks: JSON.stringify(suggestions) } });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Failed to decide link suggestion for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to record decision");
  }
}

// Finalizes the review: inserts every "approved" suggestion's anchor/link
// into the content and advances the stage. Requires every suggestion to
// have a decision first (no silently-skipped pending ones) — rejecting
// everything is a valid way to proceed with zero links applied.
export async function applyInternalLinks(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SEO") return wrongStage(`Expected stage SEO, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const suggestions = parseJson<LinkSuggestion[]>(run.internalLinks);
    if (!suggestions) return wrongStage("No link suggestions to apply yet");
    if (suggestions.some((s) => s.status === "pending")) return wrongStage("Every suggestion needs a decision (approve or reject) before applying");

    const content = await getContentRecord(run.contentType as PipelineContentType, run.contentId);
    if (!content) return wrongStage("Draft content not found");

    let html = content.content;
    for (const suggestion of suggestions) {
      if (suggestion.status !== "approved") continue;
      if (!html.includes(suggestion.anchorText)) {
        suggestion.status = "invalid";
        suggestion.invalidReason = "Anchor text no longer present in content";
        continue;
      }
      html = html.replace(suggestion.anchorText, `<a href="${suggestion.targetUrl}">${suggestion.anchorText}</a>`);
      suggestion.applied = true;
    }

    const patchResult = await patchContent(run.contentType as PipelineContentType, run.contentId, { content: sanitizeRichText(html) });
    if (!patchResult.success) return wrongStage(patchResult.error || "Failed to save internal links");

    const updated = await prisma.contentPipelineRun.update({
      where: { id: runId },
      data: { stage: "INTERNAL_LINKS", internalLinks: JSON.stringify(suggestions) },
    });
    revalidatePath(`/admin/ai-pipeline/${runId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof AuthError) return wrongStage(error.message);
    console.error(`Failed to apply internal links for run ${runId}:`, error);
    return wrongStage(error.message || "Failed to apply internal links");
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
// Stage 9: Quality Gate — ten named checks before mandatory human
// approval: Duplicate Content, Brand Voice, SEO, Search Intent, Facts,
// Links, Schema, Metadata, Alt Text, and Quality. Six are deterministic,
// computed in code (lib/content-pipeline/quality-gate.ts) rather than
// trusted to the model; four (Brand Voice, Search Intent, Facts, Quality)
// genuinely need judgment, so one AI call covers those. Advisory, not a
// hard gate: a failed check is surfaced to the human approver, never
// blocked automatically — a person always has to sign off regardless of
// what passed or failed here (see approveRunForPublish, which requires
// APPROVE permission specifically, not just EDIT, so the approver is
// never required to be the same person who ran the pipeline).
// ------------------------------------------------------

export async function runQaStage(runId: string): Promise<StageResult> {
  try {
    await requirePermission("EDIT");
    const run = await getRunOrThrow(runId);
    if (run.stage !== "SCHEMA") return wrongStage(`Expected stage SCHEMA, run is at ${run.stage}`);
    if (!run.contentId) return wrongStage("This run has no draft content yet");
    const searchIntent = parseJson<SearchIntent>(run.searchIntent);
    const research = parseJson<Research>(run.research);
    if (!searchIntent || !research) return wrongStage("Could not read this run's prior stages");
    const appliedLinks = parseJson<LinkSuggestion[]>(run.internalLinks);

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

      const duplicateCheck = await checkDuplicateContent(run.contentId, content.content);
      const linksCheck = checkLinks(content.content, appliedLinks);
      const schemaCheck = checkSchema(content.schemaJson);
      const metadataCheck = checkMetadata(content);
      const altTextCheck = checkAltText(content.featuredImage, content.featuredImageAlt);
      const seoHeadingCheck = checkSeoHeadings(content.content, searchIntent.primaryKeyword);

      const objectiveChecks: QaCheck[] = [
        { category: "Duplicate Content", label: "Not substantially similar to other published content", ...duplicateCheck },
        { category: "SEO", label: "Meta title is 60 characters or fewer", passed: (content.metaTitle?.length ?? 0) > 0 && (content.metaTitle?.length ?? 0) <= 60 },
        { category: "SEO", label: "Meta description is 160 characters or fewer", passed: (content.metaDescription?.length ?? 0) > 0 && (content.metaDescription?.length ?? 0) <= 160 },
        { category: "SEO", label: "Focus keyword appears in the content", passed: plainTextLower.includes(keywordLower) },
        { category: "SEO", label: "Focus keyword appears in the meta title", passed: (content.metaTitle ?? "").toLowerCase().includes(keywordLower) },
        { category: "SEO", label: "Focus keyword appears in a heading", ...seoHeadingCheck },
        { category: "Links", label: "Applied internal links are intact; external links counted", ...linksCheck },
        { category: "Schema", label: "Schema.org data is present and structurally valid", ...schemaCheck },
        { category: "Metadata", label: "Focus keyword, OG, and Twitter metadata are all set", ...metadataCheck },
        { category: "Alt Text", label: "Featured image has real alt text", ...altTextCheck },
        { category: "Quality", label: "Content is at least 600 words", passed: wordCount >= 600 },
        ...(forbiddenTerms.length > 0
          ? [{ category: "Brand Voice" as const, label: "No forbidden terms from the Brand Knowledge Base", passed: foundForbiddenTerms.length === 0, note: foundForbiddenTerms.length > 0 ? `Found: ${foundForbiddenTerms.join(", ")}` : undefined }]
          : []),
      ];

      const prompt = await buildQaPrompt({
        title: content.title,
        metaTitle: content.metaTitle || "",
        metaDescription: content.metaDescription || "",
        contentHtml: content.content,
        primaryKeyword: searchIntent.primaryKeyword,
        questionsToAnswer: research.questionsToAnswer,
        retrievedSources: research.retrievedSources,
      });
      const { data: aiReview, usage } = await callAiForJson<{ checks: QaCheck[]; summary: string }>(prompt.system, prompt.user);

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
    console.error(`Quality Gate stage failed for run ${runId}:`, error);
    return wrongStage(error.message || "Quality Gate stage failed");
  }
}

// ------------------------------------------------------
// Stage 10: Human Approval — a deliberate manual gate, not an AI call.
// Requires APPROVE specifically (not just EDIT) — the same permission the
// main editorial workflow (lib/workflow.ts) requires to approve
// hand-written content, and for the same reason: mandatory human approval
// should mean a genuinely separate reviewing authority, not a rubber
// stamp from whoever happened to run the pipeline (a Contributor has
// CREATE/EDIT but not APPROVE, same as for ordinary content). Recorded on
// the run itself; the actual publish-permission check still happens for
// real in the Publish stage via transitionContent, so approving here
// never bypasses PUBLISH/CREATE permission checks either.
// ------------------------------------------------------

export async function approveRunForPublish(runId: string): Promise<StageResult> {
  try {
    const session = await requirePermission("APPROVE");
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
