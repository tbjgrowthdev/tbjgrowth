import { getPageMetadata } from "@/lib/seo-meta";
import AboutPageClient from "./AboutPageClient";

export async function generateMetadata() {
  return getPageMetadata("about", {
    title: "About Us | TBJ Growth",
    description: "TBJ Growth is a UK-based digital growth agency combining proven marketing strategies with AI technology to help businesses scale.",
    path: "/about",
  });
}

export default function AboutPage() {
  return <AboutPageClient />;
}
