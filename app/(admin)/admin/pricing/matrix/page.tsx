import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import PriceMatrix from "@/components/Admin/Pricing/PriceMatrix";

export const dynamic = "force-dynamic";

export default async function MatrixPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const packages = [...data.raw.packages].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({ id: p.id, name: p.name, prices: p.prices }));
  return <PriceMatrix packages={packages} />;
}
