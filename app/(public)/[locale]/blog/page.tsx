import prisma from "@/lib/prisma";
import BlogListClient, { type BlogCardPost, type BlogCategory } from "./BlogListClient";
import NewsletterBand from "@/components/Blog/NewsletterBand";
import { getPageMetadata, publiclyVisible } from "@/lib/seo-meta";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { resolveRouteLocale } from "@/lib/i18n";
import { localizeList } from "@/lib/translation";
import { estimateReadingTime } from "@/lib/utils";
import { getBlogStrings } from "@/lib/blog-strings";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("blog", {
    title: "Blog & Insights | TBJ Growth",
    description: "Read the latest insights, strategies, and case studies on scaling B2B SaaS revenue.",
    path: "/blog",
  }, locale?.code);
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return null; // layout already notFound()s on an unknown locale

  const allPosts = await prisma.post.findMany({
    where: publiclyVisible,
    include: {
      author: true,
      categories: true,
    },
  });
  const localized = await localizeList("POST", allPosts, locale.code);

  // Lean, serialisable cards: the full post body stays on the server (only its
  // word count is used, for the read time).
  const posts: BlogCardPost[] = localized
    .map((p) => ({ post: p, date: p.publishedAt ?? p.createdAt }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ post: p, date }) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      image: p.featuredImage,
      imageAlt: p.featuredImageAlt,
      categories: p.categories.map((c) => ({ name: c.name, slug: c.slug })),
      authorName: p.author?.name ?? null,
      authorImage: p.author?.image ?? null,
      date: date.toISOString(),
      readMinutes: estimateReadingTime(p.content),
    }));

  // Filter pills come from the categories of the posts actually shown.
  const categoryMap = new Map<string, BlogCategory>();
  for (const post of posts) for (const c of post.categories) categoryMap.set(c.slug, c);
  const categories = [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const strings = getBlogStrings(locale);

  return (
    <div className="bg-background">
      <JsonLd schema={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />
      <BlogListClient
        posts={posts}
        categories={categories}
        localePrefix={locale.prefix}
        localeCode={locale.code}
        strings={strings}
      />
      <NewsletterBand strings={strings} />
    </div>
  );
}
