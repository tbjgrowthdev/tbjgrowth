import Footer from "@/components/HomeComponents/Footer";
import Navbar from "@/components/HomeComponents/Navbar";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import { getSiteSettings } from "@/app/(admin)/actions/settings";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://tbjgrowth.com";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: settings?.gbpName || "TBJ Growth",
    url: settings?.gbpWebsite || baseUrl,
    telephone: settings?.gbpPhone || settings?.phone || undefined,
    email: settings?.email || undefined,
    address: settings?.gbpAddress
      ? { "@type": "PostalAddress", streetAddress: settings.gbpAddress, addressCountry: "GB" }
      : undefined,
    areaServed: {
      "@type": "Country",
      name: "United Kingdom",
    },
    sameAs: [settings?.facebookUrl, settings?.twitterUrl, settings?.linkedinUrl, settings?.instagramUrl].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <Navbar />

      <main>{children}</main>

      <Footer settings={settings} />
      <CookieConsentBanner />
      <WebVitalsReporter />
    </>
  );
}
