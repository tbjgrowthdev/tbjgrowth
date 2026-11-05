import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import CurrenciesEditor from "@/components/Admin/Pricing/CurrenciesEditor";
import { currencyHasPrice, resolveCurrencySettings } from "@/lib/pricing/visibility";

export const dynamic = "force-dynamic";

export default async function CurrenciesPage() {
  const data = await getAdminPricing();
  if (!data) return null;
  const rows = resolveCurrencySettings(data.raw.currencies).map((c) => {
    const saved = data.raw.currencies.find((x) => x.code === c.code);
    return { code: c.code, label: saved?.label ?? "", isEnabled: c.isEnabled, sortOrder: c.sortOrder, hasPrice: currencyHasPrice(c.code, data.raw.packages) };
  });
  return <CurrenciesEditor rows={rows} />;
}
