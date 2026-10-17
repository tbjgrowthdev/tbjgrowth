import type { Brief, Outline, Research, RetrievedSource, SearchIntent } from "./types";
import type { SerpOverviewItem } from "@/lib/seo-services";
import { DEFAULT_BODY_TEMPLATE, fillTemplate, resolvePrompt } from "./prompt-library";
import { buildBrandContextBlock } from "@/lib/brand-kb/context";

type Prompt = { system: string; user: string };

const BASE_INSTRUCTION = `You are a senior content strategist and SEO writer. Reply with ONLY a single valid JSON object matching the requested shape — no markdown code fences, no commentary before or after it.`;

/**
 * Every stage's system prompt, not just the Prompt Library's per-category
 * ones — brand voice/audience/forbidden terms/terminology apply to
 * Research, Outline, Internal Links, Schema, and QA just as much as to
 * the actual Draft. `override` (a Prompt Library category's systemPrompt)
 * replaces the generic persona instruction when set, but the brand
 * context block is always appended regardless — a per-category override
 * can change tone/persona, never silently drop brand constraints.
 */
export async function buildSystemPrompt(override?: string | null): Promise<string> {
  const base = override || BASE_INSTRUCTION;
  const brandContext = await buildBrandContextBlock();
  return `${base}\n\n${brandContext}`;
}

function briefSummary(brief: Brief): string {
  const lines = [
    `Content type: ${brief.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}`,
    `Topic: ${brief.topic}`,
    `Goal: ${brief.goal}`,
    `Target audience: ${brief.audience}`,
    `Tone: ${brief.tone}`,
  ];
  if (brief.notes) lines.push(`Additional notes: ${brief.notes}`);
  if (brief.contentType === "CASE_STUDY") {
    lines.push(`Client: ${brief.clientName}`, `Industry: ${brief.industry}`, `Service provided: ${brief.serviceType}`);
    if (brief.resultsHint) lines.push(`Results to feature: ${brief.resultsHint}`);
  }
  return lines.join("\n");
}

export async function buildSearchIntentPrompt(brief: Brief): Promise<Prompt> {
  return {
    system: await buildSystemPrompt(),
    user: `Given this content brief, propose the search intent this piece should target and a primary keyword plus 4 secondary keyword candidates (real phrases a UK searcher would actually type — not the topic restated, and not branded terms unless the brief is explicitly about the brand).

${briefSummary(brief)}

Reply with JSON exactly matching:
{
  "intentType": "informational" | "commercial" | "transactional" | "navigational",
  "rationale": string (1-2 sentences on why this intent fits the goal/audience),
  "primaryKeyword": string,
  "secondaryKeywords": string[] (exactly 4 phrases, no duplicates of primaryKeyword)
}`,
  };
}

// Shared by Research (for synthesis) and Draft (for grounding the actual
// writing) — the one place retrieved sources get turned into prompt text,
// so both stages describe them to the model identically.
function formatRetrievedSources(sources: RetrievedSource[]): string {
  if (sources.length === 0) return "(No relevant approved internal material found — rely on the brief alone; do not invent facts about our services, results, or FAQs.)";
  return sources.map((s) => `- [${s.sourceType}] ${s.title}${s.url ? ` (${s.url})` : ""}\n  ${s.excerpt}`).join("\n");
}

export async function buildResearchPrompt(brief: Brief, searchIntent: SearchIntent, serpOverview: SerpOverviewItem[] | null, retrievedSources: RetrievedSource[]): Promise<Prompt> {
  const serpBlock = serpOverview?.length
    ? serpOverview.map((r) => `${r.position}. ${r.title} — ${r.url}\n   ${r.description ?? ""}`).join("\n")
    : "(No live SERP data available — reason from general knowledge of this topic instead.)";

  return {
    system: await buildSystemPrompt(),
    user: `Content brief:\n${briefSummary(brief)}\n\nTarget keyword: "${searchIntent.primaryKeyword}" (${searchIntent.intentType} intent)\n\nTop current Google results for that keyword:\n${serpBlock}\n\nApproved internal material already reviewed and published about us (use this for any claim about our own services, results, or policies — never invent one that isn't here or in the brief):\n${formatRetrievedSources(retrievedSources)}\n\nAnalyse what's already ranking and identify how this piece can be genuinely better, not just longer. Reply with JSON exactly matching:\n{\n  "commonThemes": string[] (3-6 themes/angles every top result already covers),\n  "contentGaps": string[] (2-5 things the ranking pages miss, get wrong, or under-explain — this piece's opportunity),\n  "questionsToAnswer": string[] (3-6 real reader questions this piece should answer),\n  "competitorUrls": string[] (the URLs from the list above that are the strongest competing pages, up to 5)\n}`,
  };
}

export async function buildOutlinePrompt(brief: Brief, searchIntent: SearchIntent, research: Research): Promise<Prompt> {
  return {
    system: await buildSystemPrompt(),
    user: `Content brief:\n${briefSummary(brief)}\n\nTarget keyword: "${searchIntent.primaryKeyword}"\nContent gaps to exploit: ${research.contentGaps.join("; ")}\nReader questions to answer: ${research.questionsToAnswer.join("; ")}\n\nWrite a content outline. The title must naturally include the target keyword. Reply with JSON exactly matching:\n{\n  "title": string,\n  "excerpt": string (1-2 sentence summary, used as the content's excerpt/preview),\n  "sections": [\n    { "heading": string, "level": "h2" | "h3", "summary": string (what this section covers, 1 sentence), "bullets": string[] (2-5 key points this section must make) }\n  ] (5-9 sections, mostly h2 with h3 sub-sections where a topic has sub-parts)\n}`,
  };
}

export async function buildDraftPrompt(brief: Brief, searchIntent: SearchIntent, research: Research, outline: Outline): Promise<Prompt> {
  const sectionsBlock = outline.sections
    .map((s) => `${s.level.toUpperCase()}: ${s.heading}\n  Covers: ${s.summary}\n  Key points: ${s.bullets.join("; ")}`)
    .join("\n\n");

  // BLOG/CASE_STUDY are the Prompt Library categories this stage reads.
  // The admin-editable part is only the rules/style block below — the
  // brief/outline context above and the JSON contract below are always
  // code-generated, so an edit here can change tone/formatting guidance
  // but can never break the parser that reads the model's reply.
  const category = brief.contentType === "CASE_STUDY" ? "CASE_STUDY" : "BLOG";
  const template = await resolvePrompt(category);
  const rulesBlock = template
    ? fillTemplate(template.bodyTemplate, { topic: brief.topic, title: outline.title, keyword: searchIntent.primaryKeyword, goal: brief.goal, audience: brief.audience, tone: brief.tone })
    : DEFAULT_BODY_TEMPLATE[category]!;

  return {
    system: await buildSystemPrompt(template?.systemPrompt),
    user: `Write the full body content for this piece, following the outline exactly (same headings, same order, same h2/h3 levels).

Content brief:
${briefSummary(brief)}

Title: ${outline.title}
Target keyword: "${searchIntent.primaryKeyword}" — use it naturally in the first paragraph and 2-4 more times throughout, never forced or repeated unnaturally.
Reader questions to answer somewhere in the body: ${research.questionsToAnswer.join("; ")}

Outline:
${sectionsBlock}

Approved internal material about us (ground any claim about our own services, results, or policies in this — never invent one that isn't here or in the brief):
${formatRetrievedSources(research.retrievedSources)}

${rulesBlock}

Reply with JSON exactly matching:
{ "contentHtml": string }`,
  };
}

// Plain text, not a {system, user} Prompt — image providers' generateImage()
// takes one prompt string, not a chat-style system/user split. IMAGE is a
// Prompt Library category (lib/content-pipeline/prompt-constants.ts), so
// an admin can tune style/subject guidance the same way they tune Draft's
// writing rules; the brand/topic framing around it is still code-generated.
export async function buildImageGenerationPrompt(brief: Brief, outline: Outline): Promise<string> {
  const template = await resolvePrompt("IMAGE");
  const styleGuidance = template
    ? fillTemplate(template.bodyTemplate, { topic: brief.topic, title: outline.title, goal: brief.goal, audience: brief.audience, tone: brief.tone })
    : DEFAULT_BODY_TEMPLATE.IMAGE!;
  return `A featured image for an article titled "${outline.title}", about: ${brief.topic}. ${styleGuidance}`;
}

// Alt text is always a plain accessibility description — never run through
// the Prompt Library's admin-editable template, since the one thing that
// actually matters here (accurately describing what the image shows) isn't
// something a style template should be able to override.
export async function buildAltTextPrompt(outline: Outline, imagePromptText: string): Promise<Prompt> {
  return {
    system: await buildSystemPrompt(),
    user: `Write accessible alt text for an image generated from this description: "${imagePromptText}"

The image is the featured image for an article titled "${outline.title}".

Reply with JSON exactly matching:
{ "altText": string (concise, factual description of what the image depicts, under 125 characters, no "image of"/"picture of" phrasing, no marketing language) }`,
  };
}

export async function buildSeoPrompt(title: string, excerpt: string, contentHtml: string, primaryKeyword: string): Promise<Prompt> {
  const template = await resolvePrompt("SEO");
  const instruction = template ? fillTemplate(template.bodyTemplate, { title, keyword: primaryKeyword }) : DEFAULT_BODY_TEMPLATE.SEO!;

  return {
    system: await buildSystemPrompt(template?.systemPrompt),
    user: `${instruction}

Title: ${title}
Excerpt: ${excerpt}
Target keyword: "${primaryKeyword}"
Content (HTML, for context — do not repeat it back):
${contentHtml.slice(0, 4000)}

Reply with JSON exactly matching:
{
  "metaTitle": string (≤60 characters, includes the target keyword),
  "metaDescription": string (≤160 characters, compelling, includes the target keyword),
  "ogTitle": string (≤70 characters, can be more attention-grabbing than metaTitle),
  "ogDescription": string (≤200 characters),
  "twitterTitle": string (≤70 characters),
  "twitterDescription": string (≤200 characters)
}`,
  };
}

export async function buildInternalLinksPrompt(contentHtml: string, candidates: { title: string; url: string; excerpt: string }[]): Promise<Prompt> {
  const candidateBlock = candidates.map((c) => `- "${c.title}" (${c.url}): ${c.excerpt}`).join("\n");
  return {
    system: await buildSystemPrompt(),
    user: `Here is a piece of published content (HTML) and a list of other pages already live on the same site. Suggest 2-5 internal links from this content to the most relevant pages in the list.

Content:
${contentHtml}

Candidate pages to link to:
${candidateBlock}

Rules (strict):
- "anchorText" MUST be an exact, verbatim substring copied from the content above (same casing, same punctuation) — it will be used for a literal string match, so it must exist exactly as given.
- Only use "targetUrl" values from the candidate list above — never invent a URL.
- Don't link the same targetUrl twice, and don't pick anchor text that's already inside a heading.
- Prefer natural, relevant phrases over forcing a link where one doesn't fit — fewer good links beats more weak ones.

Reply with JSON exactly matching:
{ "links": [ { "anchorText": string, "targetUrl": string, "targetTitle": string, "reason": string } ] }`,
  };
}

export async function buildSchemaPrompt(params: {
  schemaType: "BlogPosting" | "Article";
  title: string;
  description: string;
  canonicalUrl: string;
  authorName: string;
  datePublished: string;
  imageUrl?: string | null;
}): Promise<Prompt> {
  return {
    system: await buildSystemPrompt(),
    user: `Produce schema.org JSON-LD structured data for this page.

Type: ${params.schemaType}
Title: ${params.title}
Description: ${params.description}
Canonical URL: ${params.canonicalUrl}
Author name: ${params.authorName}
Date published (ISO): ${params.datePublished}
Image URL: ${params.imageUrl || "(none)"}

Reply with JSON exactly matching:
{ "schema": { ... } }

Where "schema" is a complete, valid JSON-LD object: must include "@context": "https://schema.org", "@type": "${params.schemaType}", "headline", "description", "author" (as an Organization or Person object), "datePublished", "mainEntityOfPage" (set to the canonical URL). Include "image" only if an image URL was given above.`,
  };
}

// The 4 categories here are the ones that genuinely need judgment, not a
// deterministic rule — the other 6 named categories in the Quality Gate
// (Duplicate Content, SEO, Links, Schema, Metadata, Alt Text) are computed
// in code (lib/content-pipeline/quality-gate.ts) precisely because they
// don't. The system prompt already carries the full Brand Knowledge Base
// context (see buildSystemPrompt), so "Brand Voice" judges against that,
// not a value passed in separately.
export async function buildQaPrompt(params: {
  title: string;
  metaTitle: string;
  metaDescription: string;
  contentHtml: string;
  primaryKeyword: string;
  questionsToAnswer: string[];
  retrievedSources: RetrievedSource[];
}): Promise<Prompt> {
  return {
    system: await buildSystemPrompt(),
    user: `Review this finished content as the final quality gate before it goes to MANDATORY human approval — nothing publishes without a person signing off after this, so your job is to surface anything they should look at, not to decide pass/fail yourself.

Title: ${params.title}
Meta title: ${params.metaTitle}
Meta description: ${params.metaDescription}
Target keyword: "${params.primaryKeyword}"
Reader questions this piece was supposed to answer: ${params.questionsToAnswer.join("; ") || "(none specified)"}
Approved internal sources this content's claims about us should be consistent with:
${formatRetrievedSources(params.retrievedSources)}

Content (HTML):
${params.contentHtml}

Produce checks across exactly these 4 categories (one or more checks each):
- "Brand Voice": does the tone/style actually match the brand voice described in your system prompt above?
- "Search Intent": does the content genuinely answer the target keyword's intent and the reader questions listed above?
- "Facts": are any claims about our own services, results, or policies unsupported by the approved internal sources above or inconsistent with them?
- "Quality": factual-sounding claims stated with false confidence, placeholder/lorem-ipsum-like text, awkward repetition, tone inconsistency, and whether the content delivers on its title.

Do NOT check character counts, keyword counting, schema validity, metadata completeness, alt text, or duplicate content — those are measured separately in code.

Reply with JSON exactly matching:
{
  "checks": [ { "category": "Brand Voice" | "Search Intent" | "Facts" | "Quality", "label": string, "passed": boolean, "note": string } ] (4-8 checks total, covering all 4 categories),
  "summary": string (1-2 sentence overall verdict)
}`,
  };
}
