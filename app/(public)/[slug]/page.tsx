import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });

  if (!page) {
    return { title: "Page Not Found" };
  }

  const canonical = page.canonicalUrl || `${baseUrl}/${page.slug}`;

  return {
    title: page.metaTitle || `${page.title} | TBJ Growth`,
    description: page.metaDescription || undefined,
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    robots: {
      index: page.isIndexable,
      follow: true,
    },
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || undefined,
      images: page.ogImage ? [page.ogImage] : undefined,
    },
    twitter: {
      card: (page.twitterCard as "summary" | "summary_large_image") || "summary_large_image",
    },
  };
}

export default async function DynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.page.findUnique({ where: { slug } });

  const isVisible =
    page &&
    (page.status === "PUBLISHED" ||
      (page.status === "SCHEDULED" && page.publishedAt && page.publishedAt <= new Date()));

  if (!page || !isVisible) {
    notFound();
  }

  const schemaMarkup = page.schemaJson || null;

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      {schemaMarkup && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaMarkup }} />
      )}
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
