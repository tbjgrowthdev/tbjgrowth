import { getMonitoringData } from "@/app/(admin)/actions/monitoring";
import MonitoringClient from "@/components/Admin/MonitoringClient";

export default async function MonitoringPage() {
  const { backups, uptime, errors, loginHistory } = await getMonitoringData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Monitoring</h1>
        <p className="text-caption">
          Database backups, uptime probes, and error reports. Backups and uptime checks run on a schedule in
          GitHub Actions (outside this app) and report their results here — see docs/runbooks/database-restore.md
          for the restore procedure.
        </p>
      </div>
      <MonitoringClient backups={backups} uptime={uptime} errors={errors} loginHistory={loginHistory} />
    </div>
  );
}
