import { getLinkMonitorData } from "@/app/(admin)/actions/link-monitor";
import LinkMonitorClient from "@/components/Admin/LinkMonitorClient";

export default async function LinkMonitorPage() {
  const { latest, history } = await getLinkMonitorData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Link Monitor</h1>
        <p className="text-caption">
          Scheduled crawler detecting internal 404s, external broken links, redirect chains, and redirect loops.
        </p>
      </div>
      <LinkMonitorClient latest={latest} history={history} />
    </div>
  );
}
