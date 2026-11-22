import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import ProjectQuickPost from "@/components/Admin/Clients/ProjectQuickPost";
import { listPostableProjects } from "@/app/(admin)/actions/client-projects";
import { UPDATE_TEMPLATES } from "@/lib/clients/updates";

// Quick post from anywhere: Clients -> "Post an update" -> post. Optional
// ?project= preselects one (links from the stale list).
export default async function QuickPostPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const projects = await listPostableProjects();
  const options = projects.map((p) => ({ id: p.id, title: p.title, clientName: p.client.name }));
  const preselected = options.find((p) => p.id === project);
  if (preselected) options.unshift(...options.splice(options.indexOf(preselected), 1));

  return (
    <div className="space-y-4 max-w-2xl">
      <Link href="/admin/clients" className="inline-flex min-h-11 items-center gap-1 text-sm text-caption hover:text-foreground">
        <ArrowLeft size={16} /> Clients
      </Link>
      <PageTitle>Post an update</PageTitle>
      <ProjectQuickPost projects={options} templates={UPDATE_TEMPLATES} />
    </div>
  );
}
