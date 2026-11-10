import Link from "next/link";
import { getAllJobsAction } from "@/app/(admin)/actions/content-pipeline";
import JobQueueClient from "@/components/Admin/Pipeline/JobQueueClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function AiJobQueuePage() {
  const jobs = await getAllJobsAction();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/ai-pipeline" className="text-sm text-caption hover:text-foreground">
          ← AI Content Pipeline
        </Link>
        <PageTitle className="mt-1">AI Job Queue</PageTitle>
        <p className="text-caption">Every Claude call the content pipeline has made — one job per (run, stage), retried in place rather than duplicated.</p>
      </div>

      <JobQueueClient jobs={jobs} />
    </div>
  );
}
