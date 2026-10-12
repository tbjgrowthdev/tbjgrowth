import { getPageMetadata } from "@/lib/seo-meta";
import { resolveRouteLocale } from "@/lib/i18n";
import AboutPageClient from "./AboutPageClient";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("about", {
    title: "About Us | TBJ Growth",
    description: "TBJ Growth is a UK-based digital growth agency combining proven marketing strategies with AI technology to help businesses scale.",
    path: "/about",
  }, locale?.code);
}

export default function AboutPage() {
  return <AboutPageClient />;
}
