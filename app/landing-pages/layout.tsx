/**
 * Deliberately bare. Landing pages under /landing-pages/* are one-off,
 * bespoke campaign pages — each one brings its own navbar, footer, theme
 * and typography rather than sharing chrome from here or from the main
 * (public) site layout. This file exists only so the route group can carry
 * shared behaviour later if a real need for one shows up (analytics,
 * a shared cookie banner, etc.) without every page needing to know about it.
 */
export default function LandingPagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
