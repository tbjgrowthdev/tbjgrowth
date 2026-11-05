import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import PoliciesEditor from "@/components/Admin/Pricing/PoliciesEditor";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const policies = [...data.raw.policies].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({
    id: p.id ?? null,
    key: p.key, title: p.title, text: p.text,
    overrides: Object.fromEntries(p.overrides.map((o) => [o.currency, o.text])),
  }));
  return <PoliciesEditor policies={policies} />;
}
