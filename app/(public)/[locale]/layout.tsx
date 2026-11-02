import { notFound } from "next/navigation";
import localFont from "next/font/local";
import Footer from "@/components/HomeComponents/Footer";
import Navbar from "@/components/HomeComponents/Navbar";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import JsonLd from "@/components/JsonLd";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { organizationSchema, webSiteSchema, localBusinessSchema } from "@/lib/schema";
import { resolveRouteLocale } from "@/lib/i18n";

// Inter/Syne (loaded in the root layout) are Latin-only and silently fall
// back to tofu/system-sans for Bangla/Arabic script — these are the
// non-Latin fonts for those two locales.
//
// Self-hosted (app/fonts/, the Google Fonts variable files for the bengali
// and arabic subsets, weights 400–700, SIL Open Font License) rather than
// next/font/google: that one downloads Google's CSS at build time, and when
// Google serves these families from "fonts.gstatic.com/l/font?kit=…&…" URLs,
// Turbopack's font loader fails the whole build ("next/font/google queries
// have exactly one entry"). A local file needs no network at build time.
//
// The files only contain Bengali/Arabic glyphs, so no generated fallback
// font is added: Latin text in these locales falls through to Inter (see
// fontFamily below), same as the rest of the site.
const notoBengali = localFont({
  src: "../../fonts/noto-sans-bengali-variable.woff2",
  variable: "--font-bn",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
});
const notoArabic = localFont({
  src: "../../fonts/noto-sans-arabic-variable.woff2",
  variable: "--font-ar",
  weight: "400 700",
  display: "swap",
  adjustFontFallback: false,
});

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
  const fontVariable = locale.language === "bn" ? notoBengali.variable : locale.language === "ar" ? notoArabic.variable : "";
  const fontFamily =
    locale.language === "bn"
      ? "var(--font-bn), var(--font-inter), sans-serif"
      : locale.language === "ar"
        ? "var(--font-ar), var(--font-inter), sans-serif"
        : undefined;

  return (
    // display:contents keeps this element out of the root layout's
    // `body { flex flex-col }` box model entirely — Navbar/main/Footer/etc.
    // below still lay out as if this wrapper didn't exist. It only exists
    // so the non-Latin font variable + an inherited font-family can reach
    // every child without the root layout (shared with /admin, /login,
    // /landing-pages) ever needing to know locales exist.
    <div className={fontVariable} style={{ display: "contents", fontFamily }}>
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
