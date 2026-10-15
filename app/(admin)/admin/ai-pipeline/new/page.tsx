import BriefForm from "@/components/Admin/Pipeline/BriefForm";

export default function NewPipelineRunPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New AI Content Brief</h1>
        <p className="text-caption">Describe what you want written — the pipeline takes it from here, one reviewable stage at a time.</p>
      </div>
      <BriefForm />
    </div>
  );
}
