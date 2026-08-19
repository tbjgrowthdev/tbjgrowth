import { getPricingPlans } from "@/app/(admin)/actions/pricing";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { getPageMetadata } from "@/lib/seo-meta";
import PricingClient from "./PricingClient";

export async function generateMetadata() {
  return getPageMetadata("pricing", {
    title: "Pricing | TBJ Growth",
    description: "Transparent pricing for web development, SEO, and growth marketing services from TBJ Growth.",
    path: "/pricing",
  });
}

export default async function PricingPage() {
  const [plans, settings] = await Promise.all([getPricingPlans(), getSiteSettings()]);

  const parsedPlans = plans.map((plan) => ({
    ...plan,
    features: JSON.parse(plan.features) as string[],
  }));

  return (
    <PricingClient
      plans={parsedPlans}
      usdPerGbp={settings?.usdPerGbp ?? 1.27}
      bdtPerGbp={settings?.bdtPerGbp ?? 148.0}
    />
  );
}
