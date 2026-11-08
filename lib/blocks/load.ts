import prisma from "@/lib/prisma";
import { getPublicPricing } from "@/app/(admin)/actions/pricing";
import type { PublicPackage } from "@/lib/pricing/public";
import { parseStoredBlocks, reusableBlockIds, type ConcreteBlock } from "./schema";
import { resolveBlocks, type StoredReusable } from "./resolve";

// Server-side loader for the public renderer. Not a "use server" file: nothing
// here is callable from the browser, it is only imported by server components.

export type PublicTestimonial = { id: string; clientName: string; role: string | null; company: string | null; quote: string; rating: number };
export type PublicFaq = { id: string; question: string; answer: string };

export type RenderedBlock = {
  block: ConcreteBlock;
  testimonials?: PublicTestimonial[];
  faqs?: { question: string; answer: string }[];
  packages?: PublicPackage[];
};

const DEFAULT_TESTIMONIAL_COUNT = 6;

export async function loadReusableBlocks(ids: string[]): Promise<Map<string, StoredReusable>> {
  if (ids.length === 0) return new Map();
  try {
    const rows = await prisma.contentBlock.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, data: true } });
    return new Map(rows.map((r) => [r.id, { type: r.type, data: r.data }]));
  } catch (error) {
    console.error("Failed to load reusable blocks:", error);
    return new Map();
  }
}

/** Parses a stored `blocks` column, resolves reusable references and fetches the library data each block needs. */
export async function loadRenderedBlocks(raw: string | null | undefined): Promise<RenderedBlock[]> {
  const parsed = parseStoredBlocks(raw);
  if (parsed.length === 0) return [];
  const blocks = resolveBlocks(parsed, await loadReusableBlocks(reusableBlockIds(parsed)));

  const needs = (type: ConcreteBlock["type"]) => blocks.some((b) => b.type === type);
  const [testimonials, faqs, pricing] = await Promise.all([
    needs("testimonials") ? prisma.testimonial.findMany({ orderBy: { order: "asc" } }).catch(() => []) : Promise.resolve([]),
    blocks.some((b) => b.type === "faq" && b.data.source === "library") ? prisma.faq.findMany({ orderBy: { order: "asc" } }).catch(() => []) : Promise.resolve([]),
    needs("pricing") ? getPublicPricing() : Promise.resolve(null),
  ]);

  return blocks.map((block): RenderedBlock => {
    switch (block.type) {
      case "testimonials": {
        const ids = block.data.testimonialIds;
        const chosen = ids.length
          ? ids.map((id) => testimonials.find((t) => t.id === id)).filter((t): t is (typeof testimonials)[number] => Boolean(t))
          : testimonials.slice(0, DEFAULT_TESTIMONIAL_COUNT);
        return { block, testimonials: chosen.map(({ id, clientName, role, company, quote, rating }) => ({ id, clientName, role, company, quote, rating })) };
      }
      case "faq": {
        if (block.data.source === "custom") return { block, faqs: block.data.items };
        const ids = block.data.faqIds;
        const chosen = ids.length ? ids.map((id) => faqs.find((f) => f.id === id)).filter((f): f is (typeof faqs)[number] => Boolean(f)) : faqs;
        return { block, faqs: chosen.map(({ question, answer }) => ({ question, answer })) };
      }
      case "pricing": {
        const all = pricing?.packages ?? [];
        const slugs = block.data.packageSlugs;
        return { block, packages: slugs.length ? slugs.map((s) => all.find((p) => p.slug === s)).filter((p): p is PublicPackage => Boolean(p)) : all };
      }
      default:
        return { block };
    }
  });
}
