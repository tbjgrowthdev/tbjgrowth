import { cache } from "react";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveSocialMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// generateMetadata and the page component both need this record for the same
// request — cache() means the second call is served from memory, not the DB.
const getPageBySlug = cache((slug: string) => prisma.page.findUnique({ where: { slug } }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  if (!page) {
    return { title: "Page Not Found" };
  }

  const canonical = page.canonicalUrl || `${baseUrl}/${page.slug}`;
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
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    robots: {
      index: page.isIndexable,
      follow: true,
    },
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  const isVisible =
    page &&
    (page.status === "PUBLISHED" ||
      (page.status === "SCHEDULED" && page.publishedAt && page.publishedAt <= new Date()));

  if (!page || !isVisible) {
    notFound();
  }

  const breadcrumb = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: page.title, path: `/${page.slug}` },
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
          <div dangerouslySetInnerHTML={{ __html: page.content || "" }} />
        </div>
      </article>
    </main>
  );
}
