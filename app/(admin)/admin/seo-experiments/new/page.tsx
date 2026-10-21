import { getExperimentableContentAction } from "@/app/(admin)/actions/seo-experiments";
import NewSeoExperimentForm from "@/components/Admin/NewSeoExperimentForm";

export default async function NewSeoExperiment() {
  const content = await getExperimentableContentAction();
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">New SEO Experiment</h1>
      <NewSeoExperimentForm content={content} />
    </div>
  );
}
