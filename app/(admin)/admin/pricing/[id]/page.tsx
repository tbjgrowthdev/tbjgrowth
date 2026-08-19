import { getPricingPlan } from "@/app/(admin)/actions/pricing";
import PricingPlanForm from "@/components/Admin/PricingPlanForm";
import { notFound } from "next/navigation";

export default async function EditPricingPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await getPricingPlan(id);

  if (!plan) {
    notFound();
  }

  return <PricingPlanForm initialData={plan} />;
}
