import { notFound } from "next/navigation";
import Footer from "@/components/HomeComponents/Footer";
import Navbar from "@/components/HomeComponents/Navbar";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import JsonLd from "@/components/JsonLd";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { organizationSchema, webSiteSchema, localBusinessSchema } from "@/lib/schema";
import { resolveRouteLocale } from "@/lib/i18n";
import { siteFontCss } from "@/lib/site-fonts";

// Empty on purpose: nothing is rendered at build time, but declaring it is
// what lets Next.js cache each page the first time it is requested (ISR).
// Without it the [locale] segment makes every public route dynamic, so every
// request is rendered live and `revalidate` is ignored.
export function generateStaticParams() {
  return [];
}

export default async function PublicLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  if (!locale) {
    notFound();
  }

  const settings = await getSiteSettings();

  return (
    // display:contents keeps this element out of the root layout's
    // `body { flex flex-col }` box model entirely — Navbar/main/Footer/etc.
    // below still lay out as if this wrapper didn't exist.
    <div style={{ display: "contents" }}>
      {/* Admin-chosen fonts (Settings → Typography). Overrides --font-heading /
          --font-body on <html>, so <body> and portals follow too. The CSS is
          built only from the allowlist in lib/site-fonts.ts, and every stack
          ends with the bundled Bengali and Arabic faces (loaded in the root
          layout), so those scripts never fall back to a system font in any
          locale. */}
      <style dangerouslySetInnerHTML={{ __html: siteFontCss(settings) }} />
      {/* Sets lang/dir on <html> before paint — same flash-avoidance idea
          next-themes already uses for the theme class, just hand-rolled
          here since this is a nested layout, not the root one. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`,
        }}
      />
      <JsonLd schema={[organizationSchema(settings), webSiteSchema(), localBusinessSchema(settings)]} />
      <Navbar locale={locale} />

      <main>{children}</main>

      <Footer settings={settings} locale={locale} />
      <CookieConsentBanner />
      <WebVitalsReporter />
    </div>
  );
}
