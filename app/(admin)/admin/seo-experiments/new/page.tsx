import { getExperimentableContentAction } from "@/app/(admin)/actions/seo-experiments";
import NewSeoExperimentForm from "@/components/Admin/NewSeoExperimentForm";
import PageTitle from "@/components/Admin/PageTitle";

export default async function NewSeoExperiment() {
  const content = await getExperimentableContentAction();
  return (
    <div>
      <PageTitle className="mb-6">New SEO Experiment</PageTitle>
      <NewSeoExperimentForm content={content} />
    </div>
  );
}
