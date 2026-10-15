import { prisma } from "@/lib/prisma";
import { SECTION_LABEL } from "@/lib/brand-kb/constants";
import type { RagSourceType, RetrievedSource } from "@/lib/content-pipeline/types";

// Content that has actually passed review — never a DRAFT, REVIEW, or
// CHANGES_REQUESTED row, so a factual claim grounded in "retrieval" was
// never sourced from something a reviewer hasn't signed off on yet.
const APPROVED_STATUSES = ["APPROVED", "SCHEDULED", "PUBLISHED"] as const;
const MAX_EXCERPT_LENGTH = 500;

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type Candidate = { sourceType: RagSourceType; title: string; body: string; url: string | null };

/**
 * Lexical (keyword-overlap) relevance, not vector/semantic search — this
 * project has no embeddings provider or vector store, and at this site's
 * content volume (lib/content-search.ts's own documented precedent: "this
 * scales fine at this site's content volume, revisit with real DB-level
 * [infrastructure] if that ever changes") a term-overlap score is enough
 * to surface genuinely relevant approved material without adding a new
 * AI-provider call type and a pgvector migration for it. The title is
 * weighted by repetition (counted 3x) since a query term matching the
 * title is a much stronger relevance signal than matching once in a long
 * body.
 */
function scoreCandidate(candidate: Candidate, queryTerms: string[]): number {
  const titleLower = candidate.title.toLowerCase();
  const bodyLower = candidate.body.toLowerCase();
  return queryTerms.reduce((score, term) => {
    const titleHits = titleLower.split(term).length - 1;
    const bodyHits = bodyLower.split(term).length - 1;
    return score + titleHits * 3 + bodyHits;
  }, 0);
}

/**
 * Retrieves the most relevant APPROVED material across every source type
 * the Brief could plausibly need: Pages, Services, Case Studies, FAQs,
 * Brand Knowledge Base docs, and approved/published Posts. Used by the
 * Research stage (lib/content-pipeline/stages.ts's runResearchStage) so
 * both Research's synthesis and the later Draft stage can ground factual
 * claims about the business in real, reviewed content instead of letting
 * the model invent service descriptions, case study results, or FAQ
 * answers it was never given.
 */
export async function retrieveApprovedSources(query: string, limit = 6): Promise<RetrievedSource[]> {
  const queryTerms = [...new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 2))];
  if (queryTerms.length === 0) return [];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";
  const statusFilter = { in: [...APPROVED_STATUSES] };

  const [pages, services, caseStudies, faqs, brandSections, posts] = await Promise.all([
    prisma.page.findMany({ where: { status: statusFilter, isIndexable: true } }),
    prisma.agencyService.findMany({ where: { isIndexable: true } }),
    prisma.caseStudy.findMany({ where: { status: statusFilter, isIndexable: true } }),
    prisma.faq.findMany(), // no workflow/isIndexable field — admin-authored site FAQ content is always eligible
    prisma.brandKnowledgeSection.findMany({ include: { activeVersion: true } }),
    prisma.post.findMany({ where: { status: statusFilter, isIndexable: true } }),
  ]);

  const candidates: Candidate[] = [
    ...pages.map((p): Candidate => ({ sourceType: "PAGE", title: p.title, body: stripHtml(p.content), url: `${baseUrl}/${p.slug}` })),
    ...services.map((s): Candidate => ({
      sourceType: "SERVICE",
      title: s.title,
      body: `${s.description} ${stripHtml(s.content)}`,
      url: s.slug ? `${baseUrl}/services/${s.slug}` : null,
    })),
    ...caseStudies.map((c): Candidate => ({
      sourceType: "CASE_STUDY",
      title: c.title,
      body: `${c.excerpt || ""} ${c.results || ""} ${stripHtml(c.content)}`,
      url: `${baseUrl}/case-studies/${c.slug}`,
    })),
    ...faqs.map((f): Candidate => ({ sourceType: "FAQ", title: f.question, body: f.answer, url: null })),
    ...brandSections
      .filter((b) => b.activeVersion?.content)
      .map((b): Candidate => ({ sourceType: "BRAND_DOC", title: SECTION_LABEL[b.key], body: b.activeVersion!.content, url: null })),
    ...posts.map((post): Candidate => ({
      sourceType: "POST",
      title: post.title,
      body: `${post.excerpt || ""} ${stripHtml(post.content)}`,
      url: `${baseUrl}/blog/${post.slug}`,
    })),
  ];

  return candidates
    .map((c) => ({ ...c, score: scoreCandidate(c, queryTerms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((c) => ({ sourceType: c.sourceType, title: c.title, excerpt: c.body.slice(0, MAX_EXCERPT_LENGTH), url: c.url, score: c.score }));
}
