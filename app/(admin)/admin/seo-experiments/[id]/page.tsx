import { notFound } from "next/navigation";
import { getSeoExperiment } from "@/app/(admin)/actions/seo-experiments";
import SeoExperimentDetail from "@/components/Admin/SeoExperimentDetail";

export default async function SeoExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await getSeoExperiment(id);

  if (!experiment) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{experiment.name}</h1>
      <SeoExperimentDetail experiment={experiment} />
    </div>
  );
}
