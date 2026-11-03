import { cache } from "react";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Clock, Globe, Twitter, Linkedin, Tag } from "lucide-react";
import { isValidImageSrc, parseSocialLinks } from "@/lib/utils";
import { publiclyVisible, resolveSocialMeta, buildRobotsMeta } from "@/lib/seo-meta";
import PostCover from "@/components/Blog/PostCover";
import ReadingProgress from "@/components/Blog/ReadingProgress";
import StickySidebar from "@/components/Blog/StickySidebar";
import ShareButtons from "@/components/Blog/ShareButtons";
import TableOfContents from "@/components/Blog/TableOfContents";
import JsonLd from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { buildAutoSchema } from "@/lib/schema-engine";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale, withLocalePrefix } from "@/lib/i18n";
import { resolveLocalizedContent, findContentIdBySlugInLocale, buildHreflangAlternates, localizeList } from "@/lib/translation";
import { prepareArticle } from "@/lib/blog-content";
import { getPostStrings } from "@/lib/blog-strings";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export const revalidate = 3600;

// generateMetadata and the page component both need this post for the same
// request — cache() + one shared query shape means a single DB round trip.
const getPostBySlug = cache((slug: string) =>
  prisma.post.findUnique({
    where: { slug },
    include: { author: true, categories: true, tags: true },
  })
);
const getPostById = cache((id: string) =>
  prisma.post.findUnique({
    where: { id },
    include: { author: true, categories: true, tags: true },
  })
);

/**
 * The `slug` in the URL may be a translated slug (bn-BD/ar-AE can have
 * their own) rather than the base English one — try the translation
 * mapping first, fall back to treating it as the base slug directly
 * (always correct for en-BD/en-AE, and for any translation that hasn't
 * set its own slug override yet).
 */
async function getPostForRoute(slug: string, localeCode: string) {
  const translatedId = await findContentIdBySlugInLocale("POST", localeCode, slug);
  const post = translatedId ? await getPostById(translatedId) : await getPostBySlug(slug);
  if (!post) return null;
  return resolveLocalizedContent("POST", post, localeCode);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) return { title: "Not Found" };
  const post = await getPostForRoute(slug, locale.code);

  if (!post) {
    return { title: "Post Not Found" };
  }

  const { languages } = await buildHreflangAlternates("POST", post.id, post.slug, (s) => `/blog/${s}`, post.canonicalUrl);
  const canonical = post.canonicalUrl || `${baseUrl}${withLocalePrefix(locale.prefix, `/blog/${post.slug}`)}`;
  const settings = await getSiteSettings();

  const social = resolveSocialMeta({
    baseTitle: `${post.title} | TBJ Growth`,
    baseDescription: post.excerpt,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    ogTitle: post.ogTitle,
    ogDescription: post.ogDescription,
    ogImage: post.ogImage,
    twitterTitle: post.twitterTitle,
    twitterDescription: post.twitterDescription,
    twitterImage: post.twitterImage,
    twitterCard: post.twitterCard,
    fallbackImage: post.featuredImage,
    siteDefaultImage: settings?.defaultOgImage,
  });

  return {
    title: social.title,
    description: social.description,
    alternates: { canonical, languages },
    robots: buildRobotsMeta(post.isIndexable, post.allowFollow, post.maxSnippet, post.maxImagePreview as "none" | "standard" | "large", post.maxVideoPreview),
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) notFound();
  const post = await getPostForRoute(slug, locale.code);

  const isVisible =
    post &&
    (post.status === "PUBLISHED" ||
      (post.status === "SCHEDULED" && post.publishedAt && post.publishedAt <= new Date()));

  if (!post || !isVisible) {
    notFound();
  }

  const strings = getPostStrings(locale);
  const categoryIds = post.categories.map((c: { id: string }) => c.id);
  const tagIds = post.tags.map((t: { id: string }) => t.id);

  // Related: same category or tag first, then fill up with the most recent.
  const relatedFilters = [
    ...(categoryIds.length > 0 ? [{ categories: { some: { id: { in: categoryIds } } } }] : []),
    ...(tagIds.length > 0 ? [{ tags: { some: { id: { in: tagIds } } } }] : []),
  ];
  let relatedPosts = await prisma.post.findMany({
    where: {
      AND: [publiclyVisible, { id: { not: post.id } }, ...(relatedFilters.length > 0 ? [{ OR: relatedFilters }] : [])],
    },
    include: { author: true, categories: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  if (relatedPosts.length < 3) {
    const excludeIds = [post.id, ...relatedPosts.map((p) => p.id)];
    const fallbackPosts = await prisma.post.findMany({
      where: { AND: [publiclyVisible, { id: { notIn: excludeIds } }] },
      include: { author: true, categories: true },
      orderBy: { createdAt: "desc" },
      take: 3 - relatedPosts.length,
    });
    relatedPosts.push(...fallbackPosts);
  }
  relatedPosts = await localizeList("POST", relatedPosts, locale.code);

  const article = prepareArticle(post.content);
  const authorSocial = parseSocialLinks(post.author?.socialLinks);
  const authorName = post.author?.name || "TBJ Partners";
  const fmtNumber = new Intl.NumberFormat(locale.code);
  const fmtDate = (d: Date) =>
    d.toLocaleDateString(locale.code, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const postPath = withLocalePrefix(locale.prefix, `/blog/${post.slug}`);
  const postUrl = `${baseUrl}${postPath}`;
  const blogHref = withLocalePrefix(locale.prefix, "/blog");
  const primaryCategory = post.categories[0];

  const breadcrumb = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Blog", path: blogHref },
    { name: post.title, path: postPath },
  ]);

  const avatar = (size: string, text: string) => (
    <div
      className={`relative ${size} shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-orange-deep to-brand-orange flex items-center justify-center font-bold text-white ${text}`}
    >
      {isValidImageSrc(post.author?.image) ? (
        <Image src={post.author!.image!} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        authorName.charAt(0).toUpperCase()
      )}
    </div>
  );

  const socialLink =
    "rounded-full bg-background p-2 text-muted transition-colors hover:text-brand-orange-deep dark:hover:text-brand-orange-light";

  return (
    <div className="bg-background pb-20 pt-28 lg:pt-32">
      {post.schemaJson ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: post.schemaJson }} />
      ) : (
        <JsonLd
          schema={buildAutoSchema({
            contentType: "POST",
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            featuredImage: post.featuredImage,
            authorName: post.author?.name,
            createdAt: post.publishedAt || post.createdAt,
            updatedAt: post.updatedAt,
          })}
        />
      )}
      <JsonLd schema={breadcrumb} />
      <ReadingProgress targetId="article-body" label={strings.readingProgress} />

      <article className="mx-auto max-w-[1120px] px-6">
        {/* Header */}
        <header>
          <Link
            href={blogHref}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-brand-orange-deep dark:hover:text-brand-orange-light"
          >
            <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
            {strings.backToBlog}
          </Link>

          {primaryCategory && (
            <div className="mb-5">
              <span className="inline-block rounded-full bg-tint px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light">
                {primaryCategory.name}
              </span>
            </div>
          )}

          <h1 className="max-w-[960px] text-[clamp(2.125rem,1.2rem+3.8vw,4.125rem)] font-bold leading-[1.04] tracking-[-0.02em] text-foreground">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-6 max-w-[760px] text-[17px] leading-relaxed text-muted sm:text-xl">{post.excerpt}</p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-y border-border py-5 text-sm text-muted">
            <div className="flex items-center gap-3">
              {avatar("h-11 w-11", "text-base")}
              <div className="leading-tight">
                <p className="font-semibold text-foreground">{authorName}</p>
                <p className="text-xs">{strings.authorRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} aria-hidden="true" className="text-brand-orange" />
              <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>
                {fmtDate(post.publishedAt || post.createdAt)}
              </time>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} aria-hidden="true" className="text-brand-orange" />
              <span>{strings.readTime.replace("{n}", fmtNumber.format(article.readMinutes))}</span>
            </div>
            <div className="ms-auto">
              <ShareButtons
                url={postUrl}
                title={post.title}
                labels={{
                  copyLink: strings.copyLink,
                  linkCopied: strings.linkCopied,
                  shareLinkedIn: strings.shareLinkedIn,
                  shareX: strings.shareX,
                  share: strings.share,
                }}
              />
            </div>
          </div>
        </header>

        {/* Featured image (branded placeholder when there is none) */}
        <PostCover
          id={post.id}
          src={post.featuredImage}
          alt={post.featuredImageAlt || post.title}
          sizes="(min-width: 1168px) 1072px, calc(100vw - 48px)"
          priority
          className="mt-10 aspect-[21/9] w-full rounded-3xl"
        />

        {/* Body: article + sticky sidebar */}
        <div className="mt-12 flex flex-wrap items-start gap-x-12 gap-y-12 lg:mt-16">
          <div className="min-w-0 flex-[1_1_560px] lg:max-w-[720px]">
            <div id="article-body" className="article-body" dangerouslySetInnerHTML={{ __html: article.html }} />

            {post.tags.length > 0 && (
              <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-border pt-8">
                <span className="sr-only">{strings.tags}</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-tint px-3.5 py-1.5 text-sm font-medium text-muted"
                  >
                    <Tag size={13} aria-hidden="true" />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <aside className="w-full flex-[1_1_280px] lg:w-[300px] lg:flex-none">
            <StickySidebar className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
              {article.headings.length >= 2 && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <TableOfContents headings={article.headings} title={strings.onThisPage} label={strings.contentsLabel} />
                </div>
              )}

              {/* Author */}
              <section className="rounded-2xl border border-border bg-cream p-5 dark:bg-card">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted">{strings.writtenBy}</h2>
                <div className="mb-3 flex items-center gap-3">
                  {avatar("h-14 w-14", "text-xl")}
                  <div className="min-w-0 leading-tight">
                    <p className="font-bold text-foreground">{authorName}</p>
                    <p className="text-sm text-muted">{strings.authorRole}</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">{post.author?.bio || strings.authorBio}</p>
                {(authorSocial.website || authorSocial.twitter || authorSocial.linkedin) && (
                  <div className="mt-4 flex items-center gap-2">
                    {authorSocial.website && (
                      <a href={authorSocial.website} target="_blank" rel="noopener noreferrer" aria-label="Website" className={socialLink}>
                        <Globe size={16} aria-hidden="true" />
                      </a>
                    )}
                    {authorSocial.twitter && (
                      <a href={authorSocial.twitter} target="_blank" rel="noopener noreferrer" aria-label="X / Twitter" className={socialLink}>
                        <Twitter size={16} aria-hidden="true" />
                      </a>
                    )}
                    {authorSocial.linkedin && (
                      <a href={authorSocial.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className={socialLink}>
                        <Linkedin size={16} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </section>

              {/* CTA: copy lives in lib/blog-strings.ts */}
              <section className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-charcoal p-6 text-white">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -end-16 -top-20 -z-10 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-brand-500)_40%,transparent),transparent)]"
                />
                <h2 className="text-xl font-bold leading-snug">{strings.ctaTitle}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cream/70">{strings.ctaBody}</p>
                <Link
                  href={withLocalePrefix(locale.prefix, "/book-a-call")}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-orange-deep to-brand-orange px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/25 transition-shadow hover:shadow-brand-orange/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {strings.ctaButton}
                  <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
                </Link>
              </section>
            </StickySidebar>
          </aside>
        </div>
      </article>

      {/* Keep reading */}
      {relatedPosts.length > 0 && (
        <section className="mx-auto mt-20 max-w-[1120px] px-6">
          <div className="border-t border-border pt-14">
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{strings.keepReading}</h2>
              <Link
                href={blogHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange-deep transition-colors hover:text-brand-orange dark:text-brand-orange-light"
              >
                {strings.viewAll}
                <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
              </Link>
            </div>

            {/* 1 post: one wide horizontal card; 2-3 posts: equal columns. Never a lone narrow card. */}
            <div
              className={
                relatedPosts.length === 1
                  ? "grid gap-6"
                  : "grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]"
              }
            >
              {relatedPosts.map((related) => {
                const wide = relatedPosts.length === 1;
                return (
                  <Link
                    key={related.id}
                    href={withLocalePrefix(locale.prefix, `/blog/${related.slug}`)}
                    className={`group flex overflow-hidden rounded-[22px] border border-border bg-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent-border hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                      wide ? "flex-wrap" : "flex-col"
                    }`}
                  >
                    <PostCover
                      id={related.id}
                      src={related.featuredImage}
                      alt={related.featuredImageAlt || related.title}
                      sizes={wide ? "(min-width: 768px) 560px, 100vw" : "(min-width: 1024px) 352px, (min-width: 640px) 50vw, 100vw"}
                      className={wide ? "aspect-[16/10] w-full md:aspect-auto md:min-h-[260px] md:flex-[1_1_380px]" : "aspect-[16/10] w-full"}
                      imageClassName="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                    <div className={`flex flex-col p-6 ${wide ? "min-w-0 flex-[1_1_320px] justify-center md:p-10" : "flex-1"}`}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light">
                        {strings.typeBlog}
                      </span>
                      <h3 className={`mt-2 line-clamp-3 font-bold leading-snug text-foreground transition-colors group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light ${wide ? "text-2xl" : "text-xl"}`}>
                        {related.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-muted">{related.excerpt}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
