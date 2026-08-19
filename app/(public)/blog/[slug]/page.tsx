import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Tag, Clock, Globe, Twitter, Linkedin } from "lucide-react";
import { isValidImageSrc, parseSocialLinks, estimateReadingTime } from "@/lib/utils";
import { publiclyVisible } from "@/lib/seo-meta";
import ShareButton from "@/components/Blog/ShareButton";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
  });

  if (!post) {
    return { title: "Post Not Found" };
  }

  const canonical = post.canonicalUrl || `${baseUrl}/blog/${post.slug}`;

  return {
    title: post.metaTitle || `${post.title} | TBJ Growth`,
    description: post.metaDescription || post.excerpt,
    alternates: {
      canonical,
      languages: { "en-GB": canonical },
    },
    robots: {
      index: post.isIndexable,
      follow: true,
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      images: [post.ogImage || post.featuredImage || "/default-og.png"],
    },
    twitter: {
      card: post.twitterCard || "summary_large_image",
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    include: {
      author: true,
      categories: true,
      tags: true,
    },
  });

  const isVisible =
    post &&
    (post.status === "PUBLISHED" ||
      (post.status === "SCHEDULED" && post.publishedAt && post.publishedAt <= new Date()));

  if (!post || !isVisible) {
    notFound();
  }

  const categoryIds = post.categories.map((c) => c.id);
  const relatedPosts = await prisma.post.findMany({
    where: {
      ...publiclyVisible,
      id: { not: post.id },
      ...(categoryIds.length > 0 ? { categories: { some: { id: { in: categoryIds } } } } : {}),
    },
    include: { author: true, categories: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  if (relatedPosts.length < 3) {
    const excludeIds = [post.id, ...relatedPosts.map((p) => p.id)];
    const fallbackPosts = await prisma.post.findMany({
      where: { ...publiclyVisible, id: { notIn: excludeIds } },
      include: { author: true, categories: true },
      orderBy: { createdAt: "desc" },
      take: 3 - relatedPosts.length,
    });
    relatedPosts.push(...fallbackPosts);
  }

  const readingTime = estimateReadingTime(post.content);
  const authorSocial = parseSocialLinks(post.author?.socialLinks);

  // Schema generation
  const schemaMarkup = post.schemaJson
    ? post.schemaJson
    : JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        image: post.featuredImage,
        datePublished: post.publishedAt || post.createdAt,
        dateModified: post.updatedAt,
        author: {
          "@type": "Person",
          name: post.author?.name || "TBJ Partners",
        },
      });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-24 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schemaMarkup }}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Blog
        </Link>

        {/* Header */}
        <header className="mb-10 text-center md:text-left">
          {post.categories && post.categories.length > 0 && (
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
              {post.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-semibold"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
              {post.excerpt}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-3 text-sm text-gray-500 dark:text-gray-400 border-y border-gray-200 dark:border-gray-800 py-5">
            <div className="flex items-center gap-2">
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {isValidImageSrc(post.author?.image) ? (
                  <Image src={post.author!.image!} alt={post.author?.name || "Author"} fill className="object-cover" />
                ) : (
                  (post.author?.name || "T").charAt(0)
                )}
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-200">
                {post.author?.name || "TBJ Partners"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              <span>
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              <span>{readingTime} min read</span>
            </div>
            <div className="md:ml-auto">
              <ShareButton title={post.title} />
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {isValidImageSrc(post.featuredImage) && (
          <div className="relative w-full aspect-[21/9] rounded-3xl overflow-hidden mb-16 shadow-2xl">
            <Image
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Content Layout */}
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Content */}
          <div className="flex-1 max-w-3xl min-w-0 prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:text-blue-500 prose-pre:overflow-x-auto prose-img:rounded-2xl">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>

          {/* Sidebar / Author Profile */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-8">
            {/* Author Profile */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm lg:sticky lg:top-24">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
                Written By
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                  {isValidImageSrc(post.author?.image) ? (
                    <Image src={post.author!.image!} alt={post.author?.name || "Author"} fill className="object-cover" />
                  ) : (
                    (post.author?.name || "T").charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                    {post.author?.name || "TBJ Partners"}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Growth Expert
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                {post.author?.bio || "Expert in B2B SaaS growth, technical SEO, and scaling recurring revenue."}
              </p>

              {(authorSocial.website || authorSocial.twitter || authorSocial.linkedin) && (
                <div className="flex items-center gap-3 mb-6">
                  {authorSocial.website && (
                    <a href={authorSocial.website} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Globe size={16} />
                    </a>
                  )}
                  {authorSocial.twitter && (
                    <a href={authorSocial.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Twitter size={16} />
                    </a>
                  )}
                  {authorSocial.linkedin && (
                    <a href={authorSocial.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <Linkedin size={16} />
                    </a>
                  )}
                </div>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium"
                      >
                        <Tag size={12} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 pt-16 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Keep Reading</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {relatedPosts.map((related) => (
              <Link
                key={related.id}
                href={`/blog/${related.slug}`}
                className="group flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300"
              >
                <div className="relative h-44 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {isValidImageSrc(related.featuredImage) ? (
                    <Image
                      src={related.featuredImage}
                      alt={related.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No Image</span>
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {related.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
                    {related.excerpt || "Click to read more about this topic."}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
