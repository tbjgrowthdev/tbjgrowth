import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import SettingsEditor from "@/components/Admin/Pricing/SettingsEditor";

export const dynamic = "force-dynamic";

export default async function PricingTextsPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const s = data.raw.settings;
  const values = Object.fromEntries(Object.entries(s).filter(([k]) => k !== "footnote").map(([k, v]) => [k, v[""] ?? ""]));
  return <SettingsEditor values={values} footnotes={s["footnote"] ?? {}} />;
}
