/**
 * Deliberately bare. Landing pages under /landing-pages/* are one-off,
 * bespoke campaign pages — each one brings its own navbar, footer, theme
 * and typography rather than sharing chrome from here or from the main
 * (public) site layout. This file exists only so the route group can carry
 * shared behaviour later if a real need for one shows up (analytics,
 * a shared cookie banner, etc.) without every page needing to know about it.
 *
 * Rendering: each page's content lives in `<page>/landing.tsx`, served by
 * `<page>/[[...rest]]/page.tsx`. That optional catch-all with an empty
 * generateStaticParams() is what keeps the page out of `next build`: the
 * pages read site settings and SEO overrides from the database, and builds
 * (CI included) must not need a database. The first visit renders the page
 * and caches it (R2 + regional cache, `revalidate` = 1 hour). Admin saves
 * call revalidatePublicSite() (lib/revalidate.ts), which expires this
 * layout's pages straight away. One route per page, not one shared [slug]
 * route, so each page preloads only its own fonts.
 */
export default function LandingPagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
