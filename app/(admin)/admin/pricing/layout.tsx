import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { getAdminPricing } from "@/app/(admin)/actions/pricing";
import PricingTabs from "@/components/Admin/Pricing/PricingTabs";

export default async function PricingAdminLayout({ children }: { children: ReactNode }) {
  const data = await getAdminPricing();
  if (!data) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
        You don&apos;t have permission to manage pricing.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-caption">Everything on the public /pricing page is managed here. Prices are set per currency.</p>
      </div>
      <PricingTabs />
      {data.warnings.length > 0 && (
        <div role="status" className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/50 p-4">
          <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300 mb-1">
            <AlertTriangle size={16} /> Needs attention
          </div>
          <ul className="list-disc pl-6 text-sm text-amber-900 dark:text-amber-200 space-y-0.5">
            {data.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
          </ul>
        </div>
      )}
      {children}
    </div>
  );
}
