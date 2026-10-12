import { getPageMetadata } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale } from "@/lib/i18n";
import ContactPageClient from "./ContactPageClient";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("contact", {
    title: "Contact Us | TBJ Growth",
    description: "Ready to grow? Get in touch with TBJ Growth and let's talk about your goals and how we can help you achieve them.",
    path: "/contact",
  }, locale?.code);
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return <ContactPageClient settings={settings} />;
}
