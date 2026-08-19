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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pricing Plans</h1>
          <p className="text-gray-500 dark:text-gray-400">Shown on the public /pricing page with GBP/USD/BDT toggle.</p>
        </div>
        <Link
          href="/admin/pricing/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add Plan
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Price (GBP)</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Order</th>
              <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {plans.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No pricing plans yet. Create your first one!
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      {plan.isPopular && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                      {plan.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">£{plan.priceGbp.toFixed(2)} / {plan.billingTerm}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{plan.order}</td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <Link href={`/admin/pricing/${plan.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
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
