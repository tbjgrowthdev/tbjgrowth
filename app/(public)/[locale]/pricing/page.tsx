import { getPublicPricing } from "@/app/(admin)/actions/pricing";
import { getPageMetadata } from "@/lib/seo-meta";
import { resolveRouteLocale } from "@/lib/i18n";
import PricingClient from "./PricingClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, productSchema } from "@/lib/schema";

// Admin saves call revalidatePath("/pricing"); this is the safety net.
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
  const data = await getPublicPricing();

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          // One Offer per visible currency; nothing for packages without prices.
          ...data.packages
            .filter((p) => p.prices.length > 0)
            .map((p) =>
              productSchema({
                name: p.name,
                tagline: p.tagline,
                description: p.description,
                offers: p.prices.map((pr) => ({ price: pr.monthlyValue, currency: pr.code })),
              }),
            ),
        ]}
      />
      <PricingClient data={data} />
    </>
  );
}
