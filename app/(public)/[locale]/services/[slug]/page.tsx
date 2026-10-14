import { cache } from "react";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getServiceBySlug } from "@/app/(admin)/actions/services";
import { fallbackServices } from "@/lib/fallback-services";
import ServiceDetailClient from "./ServiceDetailClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, serviceSchema, faqPageSchema } from "@/lib/schema";
import { resolveSocialMeta, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";
import { resolveLocalizedContent, findContentIdBySlugInLocale, buildHreflangAlternates } from "@/lib/translation";
import { sanitizeRichText } from "@/lib/sanitize";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

const getServiceById = cache((id: string) =>
  prisma.agencyService.findUnique({ where: { id }, include: { faqs: { orderBy: { order: "asc" } } } })
);

// generateMetadata and the page component both need this record for the same
// request — cache() means the second call is served from memory, not the DB.
// See the matching comment in blog/[slug]/page.tsx for the translated-slug
// fallback logic. Placeholder fallback services (no real DB row yet) are
// never locale-filtered — there's nothing translatable about them.
const resolveService = cache(async (slug: string, localeCode: string) => {
  const translatedId = await findContentIdBySlugInLocale("SERVICE", localeCode, slug);
  const dbService = translatedId ? await getServiceById(translatedId) : await getServiceBySlug(slug);
  if (dbService) return resolveLocalizedContent("SERVICE", dbService, localeCode);
  return fallbackServices.find((s) => s.slug === slug) || null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return { title: "Not Found" };
  const service = await resolveService(slug, locale.code);

  if (!service) {
    return { title: "Service Not Found" };
  }

  const { languages } = await buildHreflangAlternates("SERVICE", service.id, service.slug || slug, (s) => `/services/${s}`);
  const canonical = `${baseUrl}${withLocalePrefix(locale.prefix, `/services/${service.slug || slug}`)}`;
  const settings = await getSiteSettings();

  const social = resolveSocialMeta({
    baseTitle: `${service.title} | TBJ Growth`,
    baseDescription: service.subtitle || service.description,
    metaTitle: service.metaTitle,
    metaDescription: service.metaDescription,
    ogTitle: service.ogTitle,
    ogDescription: service.ogDescription,
    ogImage: service.ogImage,
    twitterTitle: service.twitterTitle,
    twitterDescription: service.twitterDescription,
    twitterImage: service.twitterImage,
    twitterCard: service.twitterCard,
    siteDefaultImage: settings?.defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: { canonical, languages },
    robots: buildRobotsMeta(service.isIndexable),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) notFound();
  const service = await resolveService(slug, locale.code);

  if (!service) {
    notFound();
  }

  const faqs = "faqs" in service && service.faqs ? service.faqs : [];

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Services", path: withLocalePrefix(locale.prefix, "/services") },
            { name: service.title, path: withLocalePrefix(locale.prefix, `/services/${service.slug || slug}`) },
          ]),
          serviceSchema(service),
          faqs.length > 0 ? faqPageSchema(faqs) : null,
        ]}
      />
      <ServiceDetailClient service={{ ...service, content: sanitizeRichText(service.content) }} localePrefix={locale.prefix} />
    </>
  );
}
