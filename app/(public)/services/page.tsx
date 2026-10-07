import { getPageMetadata } from "@/lib/seo-meta";
import { getServices } from "@/app/(admin)/actions/services";
import { fallbackServices } from "@/lib/fallback-services";
import ServicesPageClient from "./ServicesPageClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";

export const revalidate = 3600;

export async function generateMetadata() {
  return getPageMetadata("services", {
    title: "Our Services | TBJ Growth",
    description: "End-to-end digital services to build your presence, attract your audience, and scale your business with AI-powered efficiency.",
    path: "/services",
  });
}

export default async function ServicesPage() {
  const dbServices = await getServices();
  const services = dbServices.length > 0 ? dbServices : fallbackServices;
  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }])} />
      <ServicesPageClient services={services} />
    </>
  );
}
