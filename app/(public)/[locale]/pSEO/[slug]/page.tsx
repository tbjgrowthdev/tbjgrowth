import { notFound } from "next/navigation";
import { getPSeoPageBySlug } from "@/app/(admin)/actions/programmatic-seo";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveSocialMeta, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// A page still NEEDS_REVIEW never renders publicly at all — not even
// noindexed — until a human either fixes the underlying row/template and
// regenerates, or explicitly overrides it. "Controlled" means it isn't
// reachable, not just hidden from search.
async function resolvePage(slug: string) {
  const page = await getPSeoPageBySlug(slug);
  if (!page || page.status === "NEEDS_REVIEW") return null;
  return page;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return { title: "Not Found" };
  const page = await resolvePage(slug);
  if (!page) return { title: "Not Found" };

  const canonical = `${baseUrl}${withLocalePrefix(locale.prefix, `/pSEO/${page.slug}`)}`;
  const settings = await getSiteSettings();
  const social = resolveSocialMeta({
    baseTitle: page.title,
    baseDescription: page.metaDescription || undefined,
    siteDefaultImage: settings?.defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: { canonical },
    // A template-level "off" switch takes every one of its pages out of
    // the index outright, regardless of this individual page's own
    // PUBLISHED/OVERRIDDEN guardrail outcome.
    robots: buildRobotsMeta(page.template.isIndexable),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function PSeoPageDetail({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) notFound();
  const page = await resolvePage(slug);
  if (!page) notFound();

  return (
    <main className="relative bg-background transition-colors duration-500 pt-32 pb-16 lg:pt-40 lg:pb-20">
      <JsonLd
        schema={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: page.h1, path: withLocalePrefix(locale.prefix, `/pSEO/${page.slug}`) },
        ])}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">{page.h1}</h1>
        <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
      </div>
    </main>
  );
}
