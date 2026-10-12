import { getPricingPlans } from "@/app/(admin)/actions/pricing";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { getPageMetadata } from "@/lib/seo-meta";
import { resolveRouteLocale } from "@/lib/i18n";
import PricingClient from "./PricingClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, productSchema } from "@/lib/schema";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("pricing", {
    title: "Pricing | TBJ Growth",
    description: "Transparent pricing for web development, SEO, and growth marketing services from TBJ Growth.",
    path: "/pricing",
  }, locale?.code);
}

export default async function PricingPage() {
  const [plans, settings] = await Promise.all([getPricingPlans(), getSiteSettings()]);

  const parsedPlans = plans.map((plan) => ({
    ...plan,
    features: JSON.parse(plan.features) as string[],
  }));

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          ...parsedPlans.map((plan) => productSchema(plan)),
        ]}
      />
      <PricingClient
        plans={parsedPlans}
        usdPerGbp={settings?.usdPerGbp ?? 1.27}
        bdtPerGbp={settings?.bdtPerGbp ?? 148.0}
      />
    </>
  );
}
