import { getLinkMonitorData } from "@/app/(admin)/actions/link-monitor";
import LinkMonitorClient from "@/components/Admin/LinkMonitorClient";
import PageTitle from "@/components/Admin/PageTitle";

export default async function LinkMonitorPage() {
  const { latest, history } = await getLinkMonitorData();

  return (
    <div className="space-y-6">
      <div>
        <PageTitle>Link Monitor</PageTitle>
        <p className="text-caption">
          Scheduled crawler detecting internal 404s, external broken links, redirect chains, and redirect loops.
        </p>
      </div>
      <LinkMonitorClient latest={latest} history={history} />
    </div>
  );
}
