import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import PackagesList from "@/components/Admin/Pricing/PackagesList";

export const dynamic = "force-dynamic";

export default async function PricingPackagesPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const rows = [...data.raw.packages].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({
    id: p.id, slug: p.slug, number: p.number, name: p.name, tagline: p.tagline, isActive: p.isActive, isMostPopular: p.isMostPopular,
    currencies: p.prices.filter((x) => x.isActive).map((x) => x.currency),
  }));
  return <PackagesList initial={rows} />;
}
