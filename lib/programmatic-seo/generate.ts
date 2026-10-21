import prisma from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import { renderTemplate, renderSlug, stripHtml, countWords } from "./render";
import { checkRequiredColumns, checkThinContent, checkDuplicate } from "./guardrails";
import type { GuardrailFinding } from "./types";

type PoolEntry = { rowId: string | null; label: string; bodyText: string };

/**
 * Renders every row in a dataset against its template, runs the three
 * guardrails, and upserts one PSeoPage per row (keyed by rowId, so this is
 * safe to re-run after editing the template or re-uploading a corrected
 * CSV — it never creates duplicate page records for the same row).
 *
 * A row that already has an OVERRIDDEN page keeps that status untouched —
 * a human's explicit "publish anyway" decision isn't silently reverted by
 * a later regeneration, same "already-actioned rows are left alone on
 * rescan" convention as lib/orphan-pages's runOrphanPageScan. Its content
 * still re-renders, so a template edit still reaches it.
 */
export async function generatePagesForDataset(datasetId: string): Promise<{ generated: number; published: number; needsReview: number }> {
  const dataset = await prisma.pSeoDataset.findUnique({
    where: { id: datasetId },
    include: { template: true, rows: { orderBy: { rowIndex: "asc" } } },
  });
  if (!dataset) throw new Error("Dataset not found");

  const { template, rows } = dataset;
  const requiredColumns: string[] = JSON.parse(template.requiredColumns || "[]");

  const existingPages = await prisma.pSeoPage.findMany({
    where: { templateId: template.id },
    select: { rowId: true, title: true, bodyHtml: true, slug: true, status: true },
  });
  const existingByRowId = new Map(existingPages.map((p) => [p.rowId, p]));
  const takenSlugs = new Set(existingPages.map((p) => p.slug));
  const pool: PoolEntry[] = existingPages.map((p) => ({ rowId: p.rowId, label: p.title, bodyText: stripHtml(p.bodyHtml) }));

  let published = 0;
  let needsReview = 0;

  for (const row of rows) {
    const data: Record<string, string> = JSON.parse(row.data);
    const existing = existingByRowId.get(row.id);

    const title = renderTemplate(template.titleTemplate, data);
    const metaDescription = template.metaDescriptionTemplate ? renderTemplate(template.metaDescriptionTemplate, data) : null;
    const h1 = template.h1Template ? renderTemplate(template.h1Template, data) : title;
    const bodyHtml = sanitizeRichText(renderTemplate(template.bodyTemplate, data));
    const bodyText = stripHtml(bodyHtml);
    const wordCount = countWords(bodyText);

    let slug = renderSlug(template.slugTemplate, data) || `page-${row.rowIndex}`;
    if (takenSlugs.has(slug) && existing?.slug !== slug) {
      let suffix = 2;
      while (takenSlugs.has(`${slug}-${suffix}`)) suffix++;
      slug = `${slug}-${suffix}`;
    }
    takenSlugs.add(slug);

    const findings: GuardrailFinding[] = [];
    const lowValue = checkRequiredColumns(data, requiredColumns);
    if (lowValue) findings.push(lowValue);
    const thin = checkThinContent(wordCount, template.minWordCount);
    if (thin) findings.push(thin);
    const duplicate = checkDuplicate(bodyText, pool.filter((p) => p.rowId !== row.id), template.duplicateSimilarityThreshold);
    if (duplicate) findings.push(duplicate);

    const status = existing?.status === "OVERRIDDEN" ? "OVERRIDDEN" : findings.length === 0 ? "PUBLISHED" : "NEEDS_REVIEW";
    if (status === "PUBLISHED") published++;
    else if (status === "NEEDS_REVIEW") needsReview++;

    await prisma.pSeoPage.upsert({
      where: { rowId: row.id },
      create: {
        templateId: template.id,
        datasetId: dataset.id,
        rowId: row.id,
        slug,
        title,
        metaDescription,
        h1,
        bodyHtml,
        wordCount,
        status,
        guardrailFindings: JSON.stringify(findings),
      },
      update: { slug, title, metaDescription, h1, bodyHtml, wordCount, status, guardrailFindings: JSON.stringify(findings) },
    });

    const poolIdx = pool.findIndex((p) => p.rowId === row.id);
    const entry: PoolEntry = { rowId: row.id, label: title, bodyText };
    if (poolIdx >= 0) pool[poolIdx] = entry;
    else pool.push(entry);
  }

  await prisma.pSeoDataset.update({ where: { id: datasetId }, data: { rowCount: rows.length } });

  return { generated: rows.length, published, needsReview };
}
