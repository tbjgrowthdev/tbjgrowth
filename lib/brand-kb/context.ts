import { prisma } from "@/lib/prisma";
import { SECTION_LABEL } from "./constants";

// Used by every AI pipeline stage until an admin has authored anything in
// the Brand Knowledge Base — this is exactly the brand grounding that was
// previously hardcoded directly into lib/content-pipeline/prompts.ts's
// system prompt, moved here so nothing changes in the content the model
// receives the moment this feature ships (additive, not a migration).
const FALLBACK_BRAND_CONTEXT = `Brand context:
Brand: TBJ Growth, a growth-marketing agency.
Target audience: UK businesses.`;

/**
 * Assembles every Brand Knowledge Base section that has content into one
 * text block for injection into the AI's system prompt — see
 * lib/content-pipeline/prompts.ts's buildSystemPrompt(), which appends
 * this to EVERY stage's system prompt (not just the Prompt Library's
 * per-category ones), since brand voice/audience/terminology/forbidden
 * terms apply to everything the pipeline generates.
 */
export async function buildBrandContextBlock(): Promise<string> {
  const sections = await prisma.brandKnowledgeSection.findMany({ include: { activeVersion: true } });
  const withContent = sections.filter((s) => s.activeVersion?.content?.trim());
  if (withContent.length === 0) return FALLBACK_BRAND_CONTEXT;

  const lines = withContent.map((s) => `${SECTION_LABEL[s.key]}:\n${s.activeVersion!.content.trim()}`);
  return `Brand context:\n${lines.join("\n\n")}`;
}

/**
 * Real, code-computed terms for the QA stage's objective check — the
 * model is asked (via the system prompt) to avoid these, and the final
 * output is actually checked for them, not just hoped for. One term or
 * phrase per line in the FORBIDDEN_TERMS section's content.
 */
export async function getForbiddenTerms(): Promise<string[]> {
  const section = await prisma.brandKnowledgeSection.findUnique({ where: { key: "FORBIDDEN_TERMS" }, include: { activeVersion: true } });
  const content = section?.activeVersion?.content;
  if (!content) return [];
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
