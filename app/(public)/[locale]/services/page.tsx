import { getPageMetadata } from "@/lib/seo-meta";
import { getServices } from "@/app/(admin)/actions/services";
import { fallbackServices } from "@/lib/fallback-services";
import ServicesPageClient from "./ServicesPageClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveRouteLocale } from "@/lib/i18n";
import { localizeList } from "@/lib/translation";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("services", {
    title: "Our Services | TBJ Growth",
    description: "End-to-end digital services to build your presence, attract your audience, and scale your business with AI-powered efficiency.",
    path: "/services",
  }, locale?.code);
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return null;

  const dbServices = await getServices();
  // Placeholder services (shown only when no real service exists yet,
  // same ones sitemap.ts already excludes as non-real/non-indexable) are
  // never locale-filtered — there's nothing translatable about them.
  const services = dbServices.length > 0 ? await localizeList("SERVICE", dbServices, locale.code) : fallbackServices;
  return (
    <>
      <JsonLd schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }])} />
      <ServicesPageClient services={services} localePrefix={locale.prefix} />
    </>
  );
}
