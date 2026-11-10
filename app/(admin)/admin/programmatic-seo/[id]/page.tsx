import { notFound } from "next/navigation";
import { getPSeoTemplate } from "@/app/(admin)/actions/programmatic-seo";
import PSeoTemplateForm from "@/components/Admin/PSeoTemplateForm";
import PSeoDatasetManager from "@/components/Admin/PSeoDatasetManager";
import PageTitle from "@/components/Admin/PageTitle";

export default async function EditPSeoTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await getPSeoTemplate(id);

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <div>
        <PageTitle className="mb-6">Template: {template.name}</PageTitle>
        <PSeoTemplateForm initialData={template} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-6">Datasets &amp; Generated Pages</h2>
        <PSeoDatasetManager templateId={template.id} datasets={template.datasets} />
      </div>
    </div>
  );
}
