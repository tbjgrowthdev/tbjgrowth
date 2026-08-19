import { getPageMetadata } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import ContactPageClient from "./ContactPageClient";

export async function generateMetadata() {
  return getPageMetadata("contact", {
    title: "Contact Us | TBJ Growth",
    description: "Ready to grow? Get in touch with TBJ Growth and let's talk about your goals and how we can help you achieve them.",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  return <ContactPageClient settings={settings} />;
}
