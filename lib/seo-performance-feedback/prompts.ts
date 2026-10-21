import { SIGNAL_LABEL } from "./types";
import type { PerformanceSignal } from "./types";

type Prompt = { system: string; user: string };

const SYSTEM = `You are an SEO performance analyst reviewing automated monitoring signals for a content site. You are given only the signals that were actually detected from Search Console, GA4, and CMS data — never invent numbers, causes, or context beyond what's listed. Be concise, concrete, and specific to the signals given; avoid generic SEO advice that could apply to any page.`;

export function buildPerformanceFeedbackPrompt(params: { title: string; signals: PerformanceSignal[] }): Prompt {
  const signalsBlock = params.signals.map((s) => `- ${SIGNAL_LABEL[s.type]}: ${s.detail}`).join("\n");

  return {
    system: SYSTEM,
    user: `A page on this site has been flagged by automated monitoring. Diagnose what's likely going on and recommend next steps.

Page: ${params.title}

Signals detected (grounded only in real Search Console/GA4/CMS data already collected — do not assume anything beyond what's listed):
${signalsBlock}

Reply with JSON exactly matching:
{
  "summary": string (2-3 sentences, plain-English diagnosis of what's likely happening and why, referencing only the signals above),
  "recommendations": string[] (3-5 concrete, prioritized next steps; where relevant, point at the site's own tools, e.g. "run a Content Refresh draft to update the stale sections", "review this page's Cannibalization pair and decide whether to merge or differentiate", "check whether the CTA above the fold still matches search intent")
}`,
  };
}
