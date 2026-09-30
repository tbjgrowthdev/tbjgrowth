import { Anton, Manrope } from "next/font/google";
import { getPageMetadata } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import BorealLandingClient from "./BorealLandingClient";

// Scoped to this page only — bold streetwear-technical identity, independent
// of the rest of the site and of the other /landing-pages/* pages, each of
// which brings its own typography and theme.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export async function generateMetadata() {
  return getPageMetadata("boreal", {
    title: "Boreal | Winter Outerwear Engineered for the Cold",
    description:
      "Technical winter jackets and layers built for real cold — windproof shells, thermal insulation, and honest, no-nonsense design. Join the Winter 2026 drop.",
    path: "/landing-pages/boreal",
  });
}

export default async function BorealLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${anton.variable} ${manrope.variable}`}>
      <BorealLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
