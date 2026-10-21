import Link from "next/link";
import { MapPin } from "lucide-react";
import { getPageMetadata } from "@/lib/seo-meta";
import { getLocations } from "@/app/(admin)/actions/locations";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata(
    "locations",
    { title: "Our Locations | TBJ Growth", description: "Find TBJ Growth Tech's offices and the areas we serve near you.", path: "/locations" },
    locale?.code
  );
}

export default async function LocationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return null;

  const allLocations = await getLocations();
  // Only this locale's own market — a UK visitor has no reason to see the
  // Dhaka or Dubai office listed, same market-gating as the detail page.
  const locations = allLocations.filter((l) => l.market === locale.market && l.isIndexable);

  return (
    <main className="relative bg-background transition-colors duration-500 pt-32 pb-16 lg:pt-40 lg:pb-20">
      <JsonLd schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Locations", path: withLocalePrefix(locale.prefix, "/locations") }])} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">Our Locations</h1>
        {locations.length === 0 ? (
          <p className="text-muted">No locations listed for this region yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {locations.map((location) => (
              <Link
                key={location.id}
                href={withLocalePrefix(locale.prefix, `/locations/${location.slug}`)}
                className="bg-card p-6 rounded-xl border border-border hover:border-brand-orange-deep dark:hover:border-brand-orange-light transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={18} className="text-brand-orange-deep dark:text-brand-orange-light" />
                  <h2 className="font-bold text-foreground">{location.name}</h2>
                </div>
                <p className="text-sm text-muted">{location.addressLocality}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
