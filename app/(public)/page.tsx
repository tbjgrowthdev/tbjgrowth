import BusinessJourney from "@/components/HomeComponents/BusinessJourney";
import CaseStudies from "@/components/HomeComponents/CaseStudies";
import Hero from "@/components/HomeComponents/Hero";
import Services from "@/components/HomeComponents/Services";
import WhyChooseTBJ from "@/components/HomeComponents/WhyChooseTBJ";
import TBJSystems from "@/components/HomeComponents/TBJSystems";
import Testimonials from "@/components/HomeComponents/Testimonials";
import FinalCTA from "@/components/HomeComponents/FinalCTA";
import FloatingChatWidget from "@/components/HomeComponents/FloatingChatWidget";
import { getPageMetadata } from "@/lib/seo-meta";
import { getFeaturedCaseStudies } from "@/app/(admin)/actions/cases";
import { getSiteSettings } from "@/app/(admin)/actions/settings";

export async function generateMetadata() {
  return getPageMetadata("home", {
    title: "TBJ Growth | AI-Powered Digital Growth Agency",
    description: "Experience the complete business growth journey with TBJ Growth: Build, Attract, Convert, Automate, Scale.",
    path: "/",
  });
}

export default async function Home() {
  const [featuredCaseStudies, settings] = await Promise.all([
    getFeaturedCaseStudies(),
    getSiteSettings(),
  ]);

  return (
    <main className="relative bg-white dark:bg-gray-950 transition-colors duration-500">
      <Hero settings={settings} />
      <Services></Services>
      <BusinessJourney></BusinessJourney>
      <CaseStudies caseStudies={featuredCaseStudies} />
      <WhyChooseTBJ></WhyChooseTBJ>
      <TBJSystems></TBJSystems>
      <Testimonials></Testimonials>
      <FinalCTA></FinalCTA>
      <FloatingChatWidget phone={settings?.phone} />
    </main>
  );
}
