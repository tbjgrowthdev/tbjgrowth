import Footer from "@/components/HomeComponents/Footer";
import Navbar from "@/components/HomeComponents/Navbar";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import JsonLd from "@/components/JsonLd";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { organizationSchema, webSiteSchema, localBusinessSchema } from "@/lib/schema";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  return (
    <>
      <JsonLd schema={[organizationSchema(settings), webSiteSchema(), localBusinessSchema(settings)]} />
      <Navbar />

      <main>{children}</main>

      <Footer settings={settings} />
      <CookieConsentBanner />
      <WebVitalsReporter />
    </>
  );
}
