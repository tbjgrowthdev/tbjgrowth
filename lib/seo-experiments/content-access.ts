import prisma from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import type { ExperimentContentType, ExperimentField } from "./types";

const PATH_BUILDERS: Record<ExperimentContentType, (slug: string) => string> = {
  POST: (slug) => `/blog/${slug}`,
  PAGE: (slug) => `/${slug}`,
  CASE_STUDY: (slug) => `/case-studies/${slug}`,
  SERVICE: (slug) => `/services/${slug}`,
};

export interface ExperimentableContent {
  contentType: ExperimentContentType;
  contentId: string;
  title: string;
  path: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string | null;
}

/** Every piece of content an experiment could target — used by the "new experiment" picker and to snapshot a field's current value. */
export async function getExperimentableContent(): Promise<ExperimentableContent[]> {
  const [posts, pages, caseStudies, services] = await Promise.all([
    prisma.post.findMany({ select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true } }),
    prisma.page.findMany({ select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true } }),
    prisma.caseStudy.findMany({ select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true } }),
    prisma.agencyService.findMany({ select: { id: true, title: true, slug: true, metaTitle: true, metaDescription: true, content: true } }),
  ]);

  const toItem = (contentType: ExperimentContentType) => (row: { id: string; title: string; slug: string | null; metaTitle: string | null; metaDescription: string | null; content: string | null }) => ({
    contentType,
    contentId: row.id,
    title: row.title,
    path: row.slug ? PATH_BUILDERS[contentType](row.slug) : null,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    content: row.content,
  });

  return [
    ...posts.map(toItem("POST")),
    ...pages.map(toItem("PAGE")),
    ...caseStudies.map(toItem("CASE_STUDY")),
    ...services.map(toItem("SERVICE")),
  ];
}

export async function getContentRecord(contentType: ExperimentContentType, contentId: string): Promise<ExperimentableContent | null> {
  const all = await getExperimentableContent();
  return all.find((c) => c.contentType === contentType && c.contentId === contentId) ?? null;
}

/** Writes one field back to the real content record — the same write every normal edit form makes, just for a single field. */
export async function setContentField(contentType: ExperimentContentType, contentId: string, field: ExperimentField, value: string): Promise<void> {
  const data = { [field]: field === "content" ? sanitizeRichText(value) : value };
  switch (contentType) {
    case "POST":
      await prisma.post.update({ where: { id: contentId }, data });
      return;
    case "PAGE":
      await prisma.page.update({ where: { id: contentId }, data });
      return;
    case "CASE_STUDY":
      await prisma.caseStudy.update({ where: { id: contentId }, data });
      return;
    case "SERVICE":
      await prisma.agencyService.update({ where: { id: contentId }, data });
      return;
  }
}
