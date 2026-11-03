"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Clock, Search, X } from "lucide-react";
import PostCover from "@/components/Blog/PostCover";
import { isValidImageSrc } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary-url";
import { withLocalePrefix } from "@/lib/i18n";
import { formatCount, type BlogStrings } from "@/lib/blog-strings";

export type BlogCardPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  imageAlt: string | null;
  categories: { name: string; slug: string }[];
  authorName: string | null;
  authorImage: string | null;
  /** ISO date (publish date, falling back to creation date). */
  date: string;
  readMinutes: number;
};

export type BlogCategory = { name: string; slug: string };

const PAGE_SIZE = 12;
const SEARCH_URL_DELAY_MS = 300;

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  return { q: params.get("q") ?? "", category: params.get("category") ?? "" };
}

function writeFilters(q: string, category: string, mode: "push" | "replace") {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category) params.set("category", category);
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

function Avatar({ name, image, size }: { name: string; image: string | null; size: number }) {
  if (isValidImageSrc(image)) {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <Image src={cloudinaryUrl(image)} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-orange-deep to-brand-orange font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] || "T").toUpperCase()}
    </span>
  );
}

export default function BlogListClient({
  posts,
  categories,
  localePrefix,
  localeCode,
  strings,
}: {
  posts: BlogCardPost[];
  categories: BlogCategory[];
  localePrefix: string | null;
  localeCode: string;
  strings: BlogStrings;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  // Page size resets whenever the filters change (keyed, so no effect needed).
  const [limit, setLimit] = useState({ key: "", count: PAGE_SIZE });
  const focusIndex = useRef<number | null>(null);

  // The listing is statically rendered (ISR), so the filters are read from the
  // URL on the client rather than via searchParams, which would make the page
  // dynamic. The server HTML is the full unfiltered list; a shared filtered
  // link applies its filter right after hydration.
  useEffect(() => {
    const apply = () => {
      const { q, category: c } = readFilters();
      setQuery(q);
      setCategory(c);
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, []);

  // Typing updates the URL quietly (replace) so the back button isn't flooded.
  useEffect(() => {
    const t = setTimeout(() => writeFilters(query, category, "replace"), SEARCH_URL_DELAY_MS);
    return () => clearTimeout(t);
  }, [query, category]);

  const activeCategory = categories.some((c) => c.slug === category) ? category : "";
  const needle = query.trim().toLowerCase();
  const filtersActive = Boolean(needle || activeCategory);

  const filtered = useMemo(
    () =>
      posts.filter((post) => {
        const matchesSearch =
          !needle || post.title.toLowerCase().includes(needle) || (post.excerpt ?? "").toLowerCase().includes(needle);
        const matchesCategory = !activeCategory || post.categories.some((c) => c.slug === activeCategory);
        return matchesSearch && matchesCategory;
      }),
    [posts, needle, activeCategory]
  );

  // The newest post is featured on the default, unfiltered view only, and is
  // left out of the grid so it never appears twice.
  const featured = !filtersActive && filtered.length > 0 ? filtered[0] : null;
  const feed = featured ? filtered.slice(1) : filtered;
  const filterKey = `${needle}|${activeCategory}`;
  const visible = limit.key === filterKey ? limit.count : PAGE_SIZE;
  const shown = feed.slice(0, visible);

  useEffect(() => {
    if (focusIndex.current === null) return;
    document.getElementById(`blog-card-${focusIndex.current}`)?.focus();
    focusIndex.current = null;
  }, [shown.length]);

  const selectCategory = useCallback(
    (slug: string) => {
      setCategory(slug);
      writeFilters(query, slug, "push");
    },
    [query]
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    writeFilters("", "", "push");
  };

  const loadMore = () => {
    focusIndex.current = shown.length;
    setLimit({ key: filterKey, count: visible + PAGE_SIZE });
  };

  const href = (slug: string) => withLocalePrefix(localePrefix, `/blog/${slug}`);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(localeCode, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const readTime = (n: number) => strings.readTime.replace("{n}", new Intl.NumberFormat(localeCode).format(n));

  const pillBase =
    "rounded-full px-5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300";

  return (
    <>
      {/* Dark hero. Looks the same in light and dark mode. */}
      <section
        className={`relative isolate overflow-hidden bg-charcoal text-white pt-32 lg:pt-40 ${featured ? "pb-[130px]" : "pb-16"}`}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-48 -left-48 h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-brand-500)_45%,transparent),transparent)]" />
          <div className="absolute -right-32 -bottom-40 h-[460px] w-[460px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-brand-600)_35%,transparent),transparent)]" />
          <div className="blog-grid-pattern absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        </div>

        <div className="mx-auto max-w-[1200px] px-6">
          <div className="mx-auto max-w-[860px] text-center">
            <span className="inline-flex items-center rounded-full border border-brand-400/30 bg-brand-500/15 px-4 py-1.5 text-sm font-medium text-brand-300">
              {strings.pill}
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              <span className="text-white">{strings.titleLead}</span>{" "}
              <span className="text-brand-300">{strings.titleAccent}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[680px] text-[17px] leading-relaxed text-cream/70 sm:text-[19px]">
              {strings.subtitle}
            </p>

            <form
              role="search"
              onSubmit={(e) => e.preventDefault()}
              className="relative mx-auto mt-9 max-w-[680px]"
            >
              <label htmlFor="blog-search" className="sr-only">
                {strings.searchLabel}
              </label>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute start-5 top-1/2 h-5 w-5 -translate-y-1/2 text-graphite/70"
              />
              <input
                id="blog-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={strings.searchPlaceholder}
                autoComplete="off"
                className="h-[58px] w-full rounded-full bg-white ps-14 pe-5 text-base text-off-black shadow-[0_10px_30px_rgb(0_0_0/0.25)] placeholder:text-graphite/60 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-400/50 [&::-webkit-search-cancel-button]:cursor-pointer"
              />
            </form>

            {categories.length > 0 && (
              <div
                role="group"
                aria-label={strings.filterLabel}
                className="mt-6 flex flex-wrap items-center justify-center gap-2.5"
              >
                <button
                  type="button"
                  aria-pressed={!activeCategory}
                  onClick={() => selectCategory("")}
                  className={`${pillBase} ${
                    !activeCategory
                      ? "bg-brand-400 font-semibold text-charcoal"
                      : "border border-white/15 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {strings.all}
                </button>
                {categories.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={activeCategory === c.slug}
                    onClick={() => selectCategory(c.slug)}
                    className={`${pillBase} ${
                      activeCategory === c.slug
                        ? "bg-brand-400 font-semibold text-charcoal"
                        : "border border-white/15 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured post: overlaps the hero and sits above it */}
      {featured && (
        <section className="relative z-10 -mt-[76px]">
          <div className="mx-auto max-w-[1200px] px-6">
            <Link
              href={href(featured.slug)}
              className="group flex flex-wrap overflow-hidden rounded-[28px] border border-featured-border bg-card shadow-featured transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-brand-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <PostCover
                id={featured.id}
                src={featured.image}
                alt={featured.imageAlt || featured.title}
                sizes="(min-width: 1280px) 660px, (min-width: 1024px) 55vw, 100vw"
                priority
                className="min-h-[240px] flex-[1_1_520px] sm:min-h-[340px]"
                imageClassName="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <div className="flex min-w-0 flex-[1_1_360px] flex-col p-7 sm:p-10">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-semibold text-white dark:border dark:border-white/15 dark:bg-white/10">
                    {strings.featured}
                  </span>
                  {featured.categories[0] && (
                    <span className="text-xs font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light">
                      {featured.categories[0].name}
                    </span>
                  )}
                </div>
                <h2 className="mt-4 line-clamp-4 text-[clamp(1.625rem,1rem+2.2vw,2.375rem)] font-bold leading-tight text-foreground transition-colors group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light">
                  {featured.title}
                </h2>
                <p className="mt-4 line-clamp-4 text-[17px] leading-relaxed text-muted">
                  {featured.excerpt || strings.defaultExcerpt}
                </p>
                <div className="mt-auto pt-8">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-5">
                    <Avatar name={featured.authorName || strings.defaultAuthor} image={featured.authorImage} size={40} />
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-semibold text-foreground">{featured.authorName || strings.defaultAuthor}</p>
                      <p className="text-muted">{formatDate(featured.date)}</p>
                    </div>
                    <span className="ms-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange-deep dark:text-brand-orange-light">
                      {strings.readArticle}
                      <ArrowRight
                        aria-hidden="true"
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 motion-reduce:transition-none"
                      />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* All articles */}
      {(feed.length > 0 || filtersActive || posts.length === 0) && (
        <section className="mx-auto max-w-[1200px] px-6 pb-16 pt-16 lg:pt-20">
          {posts.length === 0 ? (
            <div className="py-12 text-center">
              <h2 className="text-xl font-bold text-foreground">{strings.noPostsTitle}</h2>
              <p className="mt-2 text-muted">{strings.noPostsBody}</p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{strings.allArticles}</h2>
                <p aria-live="polite" className="text-sm text-muted">
                  {formatCount(strings.showing, feed.length, localeCode)}
                </p>
              </div>

              {feed.length === 0 ? (
                <div className="rounded-[22px] border border-border bg-card px-6 py-16 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-tint text-brand-orange-deep dark:text-brand-orange-light">
                    <Search aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{strings.emptyTitle}</h3>
                  <p className="mx-auto mt-2 max-w-md text-muted">{strings.emptyBody}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-orange-deep to-brand-orange px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/25 transition-shadow hover:shadow-brand-orange/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                    {strings.clearFilters}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]">
                    {shown.map((post, i) => (
                      <Link
                        key={post.id}
                        id={`blog-card-${i}`}
                        href={href(post.slug)}
                        className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-border bg-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-accent-border hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      >
                        <PostCover
                          id={post.id}
                          src={post.image}
                          alt={post.imageAlt || post.title}
                          sizes="(min-width: 1280px) 384px, (min-width: 640px) 50vw, 100vw"
                          className="aspect-[16/10] w-full"
                          imageClassName="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                        <div className="flex flex-1 flex-col p-6">
                          {post.categories[0] && (
                            <span className="text-xs font-semibold uppercase tracking-wider text-brand-orange-deep dark:text-brand-orange-light">
                              {post.categories[0].name}
                            </span>
                          )}
                          <h3 className="mt-2 line-clamp-3 text-[21px] font-bold leading-snug text-foreground transition-colors group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light">
                            {post.title}
                          </h3>
                          <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-muted">
                            {post.excerpt || strings.defaultExcerpt}
                          </p>
                          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px] text-muted">
                            <span className="min-w-0 truncate">
                              {post.authorName || strings.defaultAuthor} · {formatDate(post.date)}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                              {readTime(post.readMinutes)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {feed.length > shown.length && (
                    <div className="mt-10 flex flex-col items-center gap-3">
                      <p className="text-sm text-muted">
                        {strings.showingOf
                          .replace("{shown}", new Intl.NumberFormat(localeCode).format(shown.length))
                          .replace("{total}", new Intl.NumberFormat(localeCode).format(feed.length))}
                      </p>
                      <button
                        type="button"
                        onClick={loadMore}
                        className="rounded-full border border-border bg-card px-7 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
                      >
                        {strings.loadMore}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
