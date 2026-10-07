import { getAuditLogs } from "@/app/(admin)/actions/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AuditLogTable from "@/components/Admin/AuditLogTable";

export default async function AuditLogPage() {
  const [logs, session] = await Promise.all([getAuditLogs(), getServerSession(authOptions)]);
  const canDelete = session?.user?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-caption">
          Every tracked mutation across content, SEO, settings, users, roles, publishing, approval, media, redirects, and integrations.
          {!canDelete && " Entries are permanent — only the Super Admin can delete them."}
        </p>
      </div>

      <AuditLogTable logs={logs} canDelete={canDelete} />
    </div>
  );
}
