import { notFound } from "next/navigation";
import { getLocationBySlug } from "@/app/(admin)/actions/locations";
import LocationDetailClient from "./LocationDetailClient";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema, faqPageSchema, locationLocalBusinessSchema } from "@/lib/schema";
import { resolveSocialMeta, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";
import { parseServiceAreas } from "@/lib/locations";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// A location only renders under a locale whose market matches its own
// (see the Location model's comment in prisma/schema.prisma) — a Dhaka
// office has nothing to say under the Gulf or UK locale, so that combination
// 404s rather than silently rendering the wrong-market content.
async function resolveLocation(slug: string, market: string) {
  const location = await getLocationBySlug(slug);
  if (!location || location.market !== market) return null;
  return location;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return { title: "Not Found" };
  const location = await resolveLocation(slug, locale.market);
  if (!location) return { title: "Location Not Found" };

  const canonical = location.canonicalUrl || `${baseUrl}${withLocalePrefix(locale.prefix, `/locations/${location.slug}`)}`;
  const settings = await getSiteSettings();

  const social = resolveSocialMeta({
    baseTitle: `${location.name} | TBJ Growth`,
    baseDescription: location.intro || `${location.name} — ${location.addressLocality}`,
    metaTitle: location.metaTitle,
    metaDescription: location.metaDescription,
    ogTitle: location.ogTitle,
    ogDescription: location.ogDescription,
    ogImage: location.ogImage,
    twitterTitle: location.twitterTitle,
    twitterDescription: location.twitterDescription,
    twitterImage: location.twitterImage,
    twitterCard: location.twitterCard,
    siteDefaultImage: settings?.defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: { canonical },
    robots: buildRobotsMeta(
      location.isIndexable,
      location.allowFollow,
      location.maxSnippet,
      location.maxImagePreview as "none" | "standard" | "large",
      location.maxVideoPreview
    ),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function LocationDetailPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) notFound();
  const location = await resolveLocation(slug, locale.market);
  if (!location) notFound();

  const faqs = location.faqs || [];
  const serviceAreas = parseServiceAreas(location.serviceAreas);

  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Locations", path: withLocalePrefix(locale.prefix, "/locations") },
            { name: location.name, path: withLocalePrefix(locale.prefix, `/locations/${location.slug}`) },
          ]),
          // Location's own schemaJson (from the admin's Schema Builder)
          // replaces the auto-generated LocalBusiness schema when set — same
          // override pattern as blog/[slug], case-studies/[slug] and
          // services/[slug].
          location.schemaJson ? null : locationLocalBusinessSchema(location, serviceAreas),
          faqs.length > 0 ? faqPageSchema(faqs) : null,
        ]}
      />
      {location.schemaJson && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: location.schemaJson }} />}
      <LocationDetailClient location={location} serviceAreas={serviceAreas} faqs={faqs} />
    </>
  );
}
