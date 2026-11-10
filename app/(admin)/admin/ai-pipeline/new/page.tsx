import BriefForm from "@/components/Admin/Pipeline/BriefForm";
import PageTitle from "@/components/Admin/PageTitle";

export default async function NewPipelineRunPage({ searchParams }: { searchParams: Promise<{ topic?: string; contentType?: string; keyword?: string; format?: string }> }) {
  const params = await searchParams;
  const initialContentType = params.contentType === "CASE_STUDY" ? "CASE_STUDY" : params.contentType === "POST" ? "POST" : undefined;

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>New AI Content Brief</PageTitle>
        <p className="text-caption">Describe what you want written — the pipeline takes it from here, one reviewable stage at a time.</p>
      </div>
      <BriefForm
        initialTopic={params.topic}
        initialContentType={initialContentType}
        initialNotes={params.keyword || params.format ? `From a content recommendation — target keyword: "${params.keyword || ""}", suggested format: ${params.format || ""}.` : undefined}
      />
    </div>
  );
}
