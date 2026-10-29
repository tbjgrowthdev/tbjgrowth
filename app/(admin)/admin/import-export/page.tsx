import { getImportExportCounts } from "@/app/(admin)/actions/import-export";
import ImportExportClient from "@/components/Admin/ImportExport/ImportExportClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export default async function ImportExportPage() {
  const [counts, session] = await Promise.all([getImportExportCounts(), getServerSession(authOptions)]);
  const role = session?.user?.role;
  const canImport = !!role && hasPermission(role, "CREATE") && hasPermission(role, "DELETE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import / Export</h1>
        <p className="text-caption">Back up or bulk-edit content, SEO metadata, redirects, and media in CSV or JSON.</p>
      </div>

      <ImportExportClient counts={counts} canImport={canImport} />
    </div>
  );
}
