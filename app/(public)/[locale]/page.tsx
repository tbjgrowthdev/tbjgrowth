import BusinessJourney from "@/components/HomeComponents/BusinessJourney";
import CaseStudies from "@/components/HomeComponents/CaseStudies";
import Hero from "@/components/HomeComponents/Hero";
import Services from "@/components/HomeComponents/Services";
import WhyChooseTBJ from "@/components/HomeComponents/WhyChooseTBJ";
import TBJSystems from "@/components/HomeComponents/TBJSystems";
import Testimonials from "@/components/HomeComponents/Testimonials";
import Faq from "@/components/HomeComponents/Faq";
import FinalCTA from "@/components/HomeComponents/FinalCTA";
import FloatingChatWidget from "@/components/HomeComponents/FloatingChatWidget";
import { getPageMetadata } from "@/lib/seo-meta";
import { getFeaturedCaseStudies } from "@/app/(admin)/actions/cases";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import { resolveRouteLocale } from "@/lib/i18n";

// Admin edits already call revalidatePath() for this route, so this TTL is
// just a safety net — the page serves from cache until content changes.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata("home", {
    title: "TBJ Growth Tech | Website, Ads & AI Automation Agency",
    description: "TBJ Growth Tech builds websites, runs Meta & Google Ads, and automates lead follow-up with AI — for UK & US businesses. Book a free strategy call.",
    path: "/",
  }, locale?.code);
}

export default async function Home() {
  const [featuredCaseStudies, settings] = await Promise.all([
    getFeaturedCaseStudies(),
    getSiteSettings(),
  ]);

  return (
    <main className="relative bg-background transition-colors duration-500">
      <Hero settings={settings} />
      <CaseStudies caseStudies={featuredCaseStudies} />
      <Services></Services>
      <BusinessJourney></BusinessJourney>
      <WhyChooseTBJ></WhyChooseTBJ>
      <TBJSystems></TBJSystems>
      {/* <Testimonials></Testimonials> */}
      <Faq></Faq>
      <FinalCTA></FinalCTA>
      <FloatingChatWidget phone={settings?.phone} />
    </main>
  );
}
