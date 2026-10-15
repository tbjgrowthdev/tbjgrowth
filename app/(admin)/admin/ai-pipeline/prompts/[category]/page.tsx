import { notFound } from "next/navigation";
import { getPromptTemplateDetailAction } from "@/app/(admin)/actions/content-pipeline";
import { DEFAULT_BODY_TEMPLATE, PROMPT_CATEGORIES } from "@/lib/content-pipeline/prompt-library";
import type { PromptCategory } from "@/lib/generated/prisma/client";
import PromptEditor from "@/components/Admin/Pipeline/PromptEditor";

export default async function PromptTemplatePage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!PROMPT_CATEGORIES.includes(category as PromptCategory)) notFound();

  const detail = await getPromptTemplateDetailAction(category as PromptCategory);
  if (!detail) notFound();
  if (detail.forbidden) {
    return <p className="text-caption">You don&apos;t have permission to view this.</p>;
  }

  return (
    <PromptEditor
      category={category as PromptCategory}
      template={detail.template}
      authors={Object.fromEntries(detail.authors)}
      defaultBodyTemplate={DEFAULT_BODY_TEMPLATE[category as PromptCategory] ?? ""}
    />
  );
}
