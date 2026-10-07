import { cache } from "react";
import { notFound } from "next/navigation";
import { getServiceBySlug } from "@/app/(admin)/actions/services";
import { fallbackServices } from "@/lib/fallback-services";
import ServiceDetailClient from "./ServiceDetailClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, serviceSchema, faqPageSchema } from "@/lib/schema";
import { resolveSocialMeta, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// generateMetadata and the page component both need this record for the same
// request — cache() means the second call is served from memory, not the DB.
const resolveService = cache(async (slug: string) => {
  const dbService = await getServiceBySlug(slug);
  if (dbService) return dbService;
  return fallbackServices.find((s) => s.slug === slug) || null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await resolveService(slug);

  if (!service) {
    return { title: "Service Not Found" };
  }

  const canonical = `${baseUrl}/services/${slug}`;
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
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    robots: buildRobotsMeta(service.isIndexable),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await resolveService(slug);

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
            { name: "Services", path: "/services" },
            { name: service.title, path: `/services/${slug}` },
          ]),
          serviceSchema(service),
          faqs.length > 0 ? faqPageSchema(faqs) : null,
        ]}
      />
      <ServiceDetailClient service={service} />
    </>
  );
}
