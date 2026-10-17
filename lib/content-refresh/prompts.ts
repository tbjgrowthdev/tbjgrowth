import { buildSystemPrompt } from "@/lib/content-pipeline/prompts";
import { DEFAULT_BODY_TEMPLATE, fillTemplate, resolvePrompt } from "@/lib/content-pipeline/prompt-library";
import type { RetrievedSource } from "@/lib/content-pipeline/types";
import type { DetectedSignal } from "./types";
import { SIGNAL_LABEL } from "./types";

type Prompt = { system: string; user: string };

export async function buildRefreshPrompt(params: {
  title: string;
  contentHtml: string;
  signals: DetectedSignal[];
  retrievedSources: RetrievedSource[];
}): Promise<Prompt> {
  const template = await resolvePrompt("REFRESH");
  const instruction = template ? fillTemplate(template.bodyTemplate, { title: params.title }) : DEFAULT_BODY_TEMPLATE.REFRESH!;

  const signalsBlock = params.signals.map((s) => `- ${SIGNAL_LABEL[s.type]}: ${s.detail}`).join("\n");
  const sourcesBlock = params.retrievedSources.length
    ? params.retrievedSources.map((s) => `- [${s.sourceType}] ${s.title}${s.url ? ` (${s.url})` : ""}\n  ${s.excerpt}`).join("\n")
    : "(none found)";

  return {
    system: await buildSystemPrompt(template?.systemPrompt),
    user: `This published content was flagged for a refresh. Revise it to address the detected issues below — never overwrite blindly; only change what the signals actually justify, and preserve what's still accurate and working.

Title: ${params.title}

Why this was flagged:
${signalsBlock}

Approved internal sources this content's claims about us should stay consistent with:
${sourcesBlock}

Current content (HTML):
${params.contentHtml}

${instruction}

Formatting rules (strict, same as a fresh draft):
- Semantic HTML body content only: <h2>, <h3>, <p>, <ul>/<ol>/<li>, <strong>, <em>, <blockquote> as needed. No <h1>, no <html>/<body>/<head> wrapper, no <a> tags (internal linking is a separate, later step), no images.
- Never invent statistics, sources, or results that weren't already in the content or the approved sources above.

Reply with JSON exactly matching:
{
  "title": string (the title, revised only if the signals justify it — otherwise unchanged),
  "contentHtml": string (the full revised body),
  "excerpt": string (1-2 sentences),
  "metaTitle": string (≤60 characters),
  "metaDescription": string (≤160 characters),
  "changeSummary": string (2-4 sentences: what you changed and why, referencing the signals above)
}`,
  };
}
