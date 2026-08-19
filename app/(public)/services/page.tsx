import { getPageMetadata } from "@/lib/seo-meta";
import ServicesPageClient from "./ServicesPageClient";

export async function generateMetadata() {
  return getPageMetadata("services", {
    title: "Our Services | TBJ Growth",
    description: "End-to-end digital services to build your presence, attract your audience, and scale your business with AI-powered efficiency.",
    path: "/services",
  });
}

export default function ServicesPage() {
  return <ServicesPageClient />;
}
