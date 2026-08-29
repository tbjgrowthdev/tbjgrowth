import { getPricingPlans, deletePricingPlan } from "@/app/(admin)/actions/pricing";
import Link from "next/link";
import { Plus, Edit, Star } from "lucide-react";
import DeleteButton from "@/components/Admin/DeleteButton";

export default async function PricingPlansList() {
  const plans = await getPricingPlans();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pricing Plans</h1>
          <p className="text-caption">Shown on the public /pricing page with GBP/USD/BDT toggle.</p>
        </div>
        <Link
          href="/admin/pricing/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors"
        >
          <Plus size={18} />
          Add Plan
        </Link>
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-background border-b border-border">
              <th className="px-6 py-4 font-medium text-caption">Name</th>
              <th className="px-6 py-4 font-medium text-caption">Price (GBP)</th>
              <th className="px-6 py-4 font-medium text-caption">Order</th>
              <th className="px-6 py-4 font-medium text-caption text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-caption">
                  No pricing plans yet. Create your first one!
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {plan.isPopular && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                      {plan.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-caption">£{plan.priceGbp.toFixed(2)} / {plan.billingTerm}</td>
                  <td className="px-6 py-4 text-caption">{plan.order}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/pricing/${plan.id}`} className="text-brand-orange-deep hover:text-brand-orange dark:text-brand-orange-light dark:hover:text-brand-orange">
                      <Edit size={18} />
                    </Link>
                    <DeleteButton id={plan.id} onDelete={deletePricingPlan} entityName="pricing plan" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
