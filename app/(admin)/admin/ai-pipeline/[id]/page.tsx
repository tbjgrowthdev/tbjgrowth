import { notFound } from "next/navigation";
import { getJobsForRunAction, getPipelineRunAction } from "@/app/(admin)/actions/content-pipeline";
import PipelineWizard from "@/components/Admin/Pipeline/PipelineWizard";

export default async function PipelineRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPipelineRunAction(id);
  if (!result) notFound();
  const jobs = await getJobsForRunAction(id);

  return <PipelineWizard run={result.run} content={result.content} jobs={jobs} />;
}
