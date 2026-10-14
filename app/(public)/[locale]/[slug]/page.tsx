import { cache } from "react";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveSocialMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";
import { resolveLocalizedContent, findContentIdBySlugInLocale, buildHreflangAlternates } from "@/lib/translation";
import { sanitizeRichText } from "@/lib/sanitize";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// generateMetadata and the page component both need this record for the same
// request — cache() means the second call is served from memory, not the DB.
const getPageBySlug = cache((slug: string) => prisma.page.findUnique({ where: { slug } }));
const getPageById = cache((id: string) => prisma.page.findUnique({ where: { id } }));

// See the matching comment in blog/[slug]/page.tsx for the translated-slug
// fallback logic.
async function getPageForRoute(slug: string, localeCode: string) {
  const translatedId = await findContentIdBySlugInLocale("PAGE", localeCode, slug);
  const page = translatedId ? await getPageById(translatedId) : await getPageBySlug(slug);
  if (!page) return null;
  return resolveLocalizedContent("PAGE", page, localeCode);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return { title: "Not Found" };
  const page = await getPageForRoute(slug, locale.code);

  if (!page) {
    return { title: "Page Not Found" };
  }

  const { languages } = await buildHreflangAlternates("PAGE", page.id, page.slug, (s) => `/${s}`);
  const canonical = page.canonicalUrl || `${baseUrl}${withLocalePrefix(locale.prefix, `/${page.slug}`)}`;
  const settings = await getSiteSettings();

  const social = resolveSocialMeta({
    baseTitle: `${page.title} | TBJ Growth`,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    ogImage: page.ogImage,
    twitterTitle: page.twitterTitle,
    twitterDescription: page.twitterDescription,
    twitterImage: page.twitterImage,
    twitterCard: page.twitterCard,
    siteDefaultImage: settings?.defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: { canonical, languages },
    robots: {
      index: page.isIndexable,
      follow: true,
    },
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) notFound();
  const page = await getPageForRoute(slug, locale.code);

  const isVisible =
    page &&
    (page.status === "PUBLISHED" ||
      (page.status === "SCHEDULED" && page.publishedAt && page.publishedAt <= new Date()));

  if (!page || !isVisible) {
    notFound();
  }

  const breadcrumb = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: page.title, path: withLocalePrefix(locale.prefix, `/${page.slug}`) },
  ]);

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      {page.schemaJson && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: page.schemaJson }} />
      )}
      <JsonLd schema={breadcrumb} />
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight mb-10 text-center">
          {page.title}
        </h1>
        <div className="prose prose-lg dark:prose-invert max-w-3xl mx-auto prose-headings:font-bold prose-a:text-brand-orange-deep dark:prose-a:text-brand-orange-light hover:prose-a:text-brand-orange prose-pre:overflow-x-auto prose-img:rounded-2xl">
          <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(page.content) }} />
        </div>
      </article>
    </main>
  );
}
