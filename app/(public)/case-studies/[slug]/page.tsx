import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Building2, Briefcase, TrendingUp } from "lucide-react";
import { isValidImageSrc } from "@/lib/utils";
import ShareButton from "@/components/Blog/ShareButton";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = await prisma.caseStudy.findUnique({ where: { slug } });

  if (!study) {
    return { title: "Case Study Not Found" };
  }

  const canonical = study.canonicalUrl || `${baseUrl}/case-studies/${study.slug}`;

  return {
    title: study.metaTitle || `${study.title} | TBJ Growth`,
    description: study.metaDescription || study.excerpt,
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    robots: {
      index: study.isIndexable,
      follow: true,
    },
    openGraph: {
      title: study.metaTitle || study.title,
      description: study.metaDescription || study.excerpt,
      images: [study.ogImage || study.featuredImage || "/default-og.png"],
    },
    twitter: {
      card: study.twitterCard || "summary_large_image",
    },
  };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = await prisma.caseStudy.findUnique({
    where: { slug },
    include: { author: true },
  });

  const isVisible =
    study &&
    (study.status === "PUBLISHED" ||
      (study.status === "SCHEDULED" && study.publishedAt && study.publishedAt <= new Date()));

  if (!study || !isVisible) {
    notFound();
  }

  const schemaMarkup = study.schemaJson
    ? study.schemaJson
    : JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: study.title,
        description: study.excerpt,
        image: study.featuredImage,
        datePublished: study.publishedAt || study.createdAt,
        dateModified: study.updatedAt,
        author: {
          "@type": "Person",
          name: study.author?.name || "TBJ Growth",
        },
      });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-24 pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaMarkup }} />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/case-studies"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Case Studies
        </Link>

        <header className="mb-10 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-semibold">
              {study.serviceType}
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm font-semibold">
              {study.industry}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
            {study.title}
          </h1>

          {study.excerpt && (
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
              {study.excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-3 text-sm text-gray-500 dark:text-gray-400 border-y border-gray-200 dark:border-gray-800 py-5">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-gray-200">{study.clientName}</span>
            </div>
            {study.results && (
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                <span>{study.results}</span>
              </div>
            )}
            <div className="md:ml-auto">
              <ShareButton title={study.title} />
            </div>
          </div>
        </header>

        {isValidImageSrc(study.featuredImage) && (
          <div className="relative w-full aspect-[21/9] rounded-3xl overflow-hidden mb-12 shadow-2xl">
            <Image
              src={study.featuredImage}
              alt={study.featuredImageAlt || study.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="max-w-3xl mx-auto lg:mx-0 prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:text-blue-500 prose-pre:overflow-x-auto prose-img:rounded-2xl">
          <div dangerouslySetInnerHTML={{ __html: study.content }} />
        </div>

        {study.imageGallery && study.imageGallery.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Briefcase size={22} className="text-blue-500" />
              Project Gallery
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {study.imageGallery.map((url: string, i: number) => (
                <div key={url} className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  <Image src={url} alt={`${study.title} gallery image ${i + 1}`} fill className="object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </main>
  );
}
