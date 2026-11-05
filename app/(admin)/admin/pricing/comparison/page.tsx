import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import ComparisonEditor from "@/components/Admin/Pricing/ComparisonEditor";

export const dynamic = "force-dynamic";

export default async function ComparisonPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const packages = [...data.raw.packages].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({ id: p.id, name: p.name }));
  const rows = [...data.raw.comparisonRows].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({
    id: r.id ?? null,
    label: r.label,
    cells: Object.fromEntries(r.cells.map((c) => [c.packageId, c.text])),
  }));
  return <ComparisonEditor packages={packages} rows={rows} />;
}
