import { notFound } from "next/navigation";
import { getJobsForRefreshAction, getRefreshDetailAction } from "@/app/(admin)/actions/content-refresh";
import RefreshDetailClient from "@/components/Admin/ContentRefresh/RefreshDetailClient";

export default async function ContentRefreshDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getRefreshDetailAction(id);
  if (!detail) notFound();
  const jobs = await getJobsForRefreshAction(id);

  return <RefreshDetailClient refresh={detail.refresh} content={detail.content} jobs={jobs} />;
}
