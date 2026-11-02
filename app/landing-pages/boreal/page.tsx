// Self-hosted (app/fonts/, Google Fonts files under the SIL Open Font License)
// instead of the Google font loader, whose build-time download intermittently
// breaks Turbopack builds — see app/(public)/[locale]/layout.tsx.
import localFont from "next/font/local";
import { getPageMetadata, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import BorealLandingClient from "./BorealLandingClient";

// Scoped to this page only — bold streetwear-technical identity, independent
// of the rest of the site and of the other /landing-pages/* pages, each of
// which brings its own typography and theme.
const anton = localFont({
  src: "../../fonts/anton-latin-normal-400.woff2",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const manrope = localFont({
  src: "../../fonts/manrope-latin-normal-300-800.woff2",
  weight: "300 800",
  variable: "--font-manrope",
  display: "swap",
});

export async function generateMetadata() {
  const meta = await getPageMetadata("boreal", {
    title: "Boreal | Winter Outerwear Engineered for the Cold",
    description:
      "Technical winter jackets and layers built for real cold — windproof shells, thermal insulation, and honest, no-nonsense design. Join the Winter 2026 drop.",
    path: "/landing-pages/boreal",
  });
  // Fictional demo brand for portfolio purposes, not a real business — never index.
  return { ...meta, robots: buildRobotsMeta(false) };
}

export default async function BorealLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${anton.variable} ${manrope.variable}`}>
      <BorealLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
