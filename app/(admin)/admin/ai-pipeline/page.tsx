import Link from "next/link";
import { Plus, ListChecks, DollarSign, BookText } from "lucide-react";
import { getPipelineRunsAction } from "@/app/(admin)/actions/content-pipeline";
import { STAGE_LABEL } from "@/lib/content-pipeline/types";

export default async function AiPipelinePage() {
  const runs = await getPipelineRunsAction();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Content Pipeline</h1>
          <p className="text-caption">
            Brief → Search Intent → Research → Outline → Draft → SEO → Internal Links → Schema → QA → Human Approval → Publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/ai-pipeline/prompts" className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors text-sm">
            <BookText size={16} />
            Prompt Library
          </Link>
          <Link href="/admin/ai-pipeline/costs" className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors text-sm">
            <DollarSign size={16} />
            Cost Dashboard
          </Link>
          <Link href="/admin/ai-pipeline/jobs" className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors text-sm">
            <ListChecks size={16} />
            Job Queue
          </Link>
          <Link
            href="/admin/ai-pipeline/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
          >
            <Plus size={18} />
            New Brief
          </Link>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Topic</th>
              <th className="px-6 py-4 font-medium text-caption">Type</th>
              <th className="px-6 py-4 font-medium text-caption">Stage</th>
              <th className="px-6 py-4 font-medium text-caption">Created by</th>
              <th className="px-6 py-4 font-medium text-caption">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-caption">
                  No pipeline runs yet. Start one from a brief.
                </td>
              </tr>
            ) : (
              runs.map((run) => {
                let topic = run.id;
                try {
                  topic = JSON.parse(run.brief)?.topic || run.id;
                } catch {
                  // fall back to id
                }
                return (
                  <tr key={run.id} className="hover:bg-background transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/admin/ai-pipeline/${run.id}`} className="hover:text-brand-orange-deep dark:hover:text-brand-orange-light">
                        {topic}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-caption">{run.contentType === "CASE_STUDY" ? "Case Study" : "Blog Post"}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-tint text-brand-orange-deep dark:text-brand-orange-light">
                        {STAGE_LABEL[run.stage]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-caption">{run.createdBy?.name || run.createdBy?.email || "Unknown"}</td>
                    <td className="px-6 py-4 text-caption">{new Date(run.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
