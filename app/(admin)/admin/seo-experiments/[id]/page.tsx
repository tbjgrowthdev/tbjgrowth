import { notFound } from "next/navigation";
import { getSeoExperiment } from "@/app/(admin)/actions/seo-experiments";
import SeoExperimentDetail from "@/components/Admin/SeoExperimentDetail";
import PageTitle from "@/components/Admin/PageTitle";

export default async function SeoExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await getSeoExperiment(id);

  if (!experiment) {
    notFound();
  }

  return (
    <div>
      <PageTitle className="mb-6">{experiment.name}</PageTitle>
      <SeoExperimentDetail experiment={experiment} />
    </div>
  );
}
