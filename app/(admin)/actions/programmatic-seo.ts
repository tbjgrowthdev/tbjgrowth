"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePermission, requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { parseCsv } from "@/lib/programmatic-seo/csv";
import { extractPlaceholders } from "@/lib/programmatic-seo/render";
import { generatePagesForDataset } from "@/lib/programmatic-seo/generate";
import type { GuardrailFinding } from "@/lib/programmatic-seo/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// ---- Templates ----

export async function getPSeoTemplates() {
  try {
    await requireSession();
    return await prisma.pSeoTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { datasets: true, pages: true } } },
    });
  } catch (error) {
    console.error("Failed to fetch pSEO templates:", error);
    return [];
  }
}

export async function getPSeoTemplate(id: string) {
  try {
    await requireSession();
    return await prisma.pSeoTemplate.findUnique({
      where: { id },
      include: { datasets: { orderBy: { createdAt: "desc" }, include: { _count: { select: { rows: true } } } } },
    });
  } catch (error) {
    console.error(`Failed to fetch pSEO template ${id}:`, error);
    return null;
  }
}

export async function createPSeoTemplate(data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("CREATE");
    const template = await prisma.pSeoTemplate.create({ data: data as Parameters<typeof prisma.pSeoTemplate.create>[0]["data"] });
    revalidatePath("/admin/programmatic-seo");
    await logAudit({ action: "create", category: "Content", entityType: "PSeoTemplate", entityId: template.id, entityLabel: template.name });
    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to create pSEO template:", error);
    return { success: false, error: errorMessage(error, "Failed to create template") };
  }
}

export async function updatePSeoTemplate(id: string, data: Record<string, unknown>): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("EDIT");
    const template = await prisma.pSeoTemplate.update({ where: { id }, data: data as Parameters<typeof prisma.pSeoTemplate.update>[0]["data"] });
    revalidatePath("/admin/programmatic-seo");
    revalidatePath("/pSEO/[slug]", "page");
    await logAudit({ action: "update", category: "Content", entityType: "PSeoTemplate", entityId: template.id, entityLabel: template.name });
    return { success: true, data: { id: template.id } };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to update pSEO template ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to update template") };
  }
}

export async function deletePSeoTemplate(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("DELETE");
    const before = await prisma.pSeoTemplate.findUnique({ where: { id } });
    await prisma.pSeoTemplate.delete({ where: { id } });
    revalidatePath("/admin/programmatic-seo");
    await logAudit({ action: "delete", category: "Content", entityType: "PSeoTemplate", entityId: id, entityLabel: before?.name });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to delete pSEO template ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to delete template") };
  }
}

// ---- Datasets ----

export async function uploadPSeoDataset(
  templateId: string,
  name: string,
  csvText: string
): Promise<ActionResult<{ id: string; rowCount: number; warnings: string[] }>> {
  try {
    await requirePermission("CREATE");
    const template = await prisma.pSeoTemplate.findUnique({ where: { id: templateId } });
    if (!template) return { success: false, error: "Template not found" };

    const { columns, rows } = parseCsv(csvText);
    if (rows.length === 0) return { success: false, error: "No data rows found in that CSV" };

    const warnings: string[] = [];
    const requiredColumns: string[] = JSON.parse(template.requiredColumns || "[]");
    const missingRequired = requiredColumns.filter((c) => !columns.includes(c));
    if (missingRequired.length > 0) {
      warnings.push(`This CSV has no column for the required field(s): ${missingRequired.join(", ")} — every row will fail the low-value guardrail.`);
    }
    const placeholders = extractPlaceholders(template.titleTemplate, template.metaDescriptionTemplate, template.h1Template, template.bodyTemplate, template.slugTemplate);
    const unresolved = placeholders.filter((p) => !columns.includes(p));
    if (unresolved.length > 0) {
      warnings.push(`The template references {{${unresolved.join("}}, {{")}}} which this CSV has no column for — those placeholders will render literally.`);
    }

    const dataset = await prisma.pSeoDataset.create({
      data: {
        templateId,
        name,
        columns: JSON.stringify(columns),
        rowCount: rows.length,
        rows: { create: rows.map((data, i) => ({ data: JSON.stringify(data), rowIndex: i })) },
      },
    });

    revalidatePath("/admin/programmatic-seo");
    await logAudit({
      action: "create",
      category: "Content",
      entityType: "PSeoDataset",
      entityId: dataset.id,
      entityLabel: `${name} (${rows.length} rows)`,
    });

    return { success: true, data: { id: dataset.id, rowCount: rows.length, warnings } };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error("Failed to upload pSEO dataset:", error);
    return { success: false, error: errorMessage(error, "Failed to upload dataset") };
  }
}

export async function deletePSeoDataset(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("DELETE");
    const before = await prisma.pSeoDataset.findUnique({ where: { id } });
    await prisma.pSeoDataset.delete({ where: { id } });
    revalidatePath("/admin/programmatic-seo");
    await logAudit({ action: "delete", category: "Content", entityType: "PSeoDataset", entityId: id, entityLabel: before?.name });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to delete pSEO dataset ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to delete dataset") };
  }
}

// ---- Generation & review ----

export async function runPSeoGeneration(datasetId: string): Promise<ActionResult<{ generated: number; published: number; needsReview: number }>> {
  try {
    await requirePermission("EDIT");
    const result = await generatePagesForDataset(datasetId);
    revalidatePath("/admin/programmatic-seo");
    revalidatePath("/pSEO/[slug]", "page");
    await logAudit({
      action: "update",
      category: "Content",
      entityType: "PSeoDataset",
      entityId: datasetId,
      entityLabel: `Generated ${result.generated} pages (${result.published} published, ${result.needsReview} need review)`,
    });
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to generate pages for dataset ${datasetId}:`, error);
    return { success: false, error: errorMessage(error, "Generation failed") };
  }
}

export async function listPSeoPages(datasetId: string) {
  try {
    await requireSession();
    const pages = await prisma.pSeoPage.findMany({ where: { datasetId }, orderBy: { createdAt: "asc" } });
    return pages.map((p) => ({ ...p, guardrailFindings: JSON.parse(p.guardrailFindings) as GuardrailFinding[] }));
  } catch (error) {
    console.error(`Failed to list pSEO pages for dataset ${datasetId}:`, error);
    return [];
  }
}

/** A human explicitly publishing a page despite its guardrail flag(s) — the only way a NEEDS_REVIEW page ever becomes indexable without the underlying row/template changing. */
export async function overridePSeoPage(id: string): Promise<ActionResult<null>> {
  try {
    await requirePermission("EDIT");
    const page = await prisma.pSeoPage.update({ where: { id }, data: { status: "OVERRIDDEN" } });
    revalidatePath("/pSEO/[slug]", "page");
    revalidatePath("/admin/programmatic-seo");
    await logAudit({ action: "update", category: "Content", entityType: "PSeoPage", entityId: id, entityLabel: `Overrode: ${page.title}` });
    return { success: true, data: null };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: error.message };
    console.error(`Failed to override pSEO page ${id}:`, error);
    return { success: false, error: errorMessage(error, "Failed to override page") };
  }
}

// getPSeoPageBySlug is consumed by the public pSEO route — stays unguarded.
export async function getPSeoPageBySlug(slug: string) {
  try {
    return await prisma.pSeoPage.findUnique({ where: { slug }, include: { template: true } });
  } catch (error) {
    console.error(`Failed to fetch pSEO page with slug ${slug}:`, error);
    return null;
  }
}
