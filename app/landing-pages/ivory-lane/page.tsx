// Self-hosted (app/fonts/, Google Fonts files under the SIL Open Font License)
// instead of the Google font loader, whose build-time download intermittently
// breaks Turbopack builds — see app/(public)/[locale]/layout.tsx.
import localFont from "next/font/local";
import { getPageMetadata, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import IvoryLaneLandingClient from "./IvoryLaneLandingClient";

// Scoped to this page only — a warm, editorial, romantic identity independent
// of the rest of the site and of the other /landing-pages/* pages.
const playfair = localFont({
  src: [
    { path: "../../fonts/playfair-display-latin-normal-400-700.woff2", weight: "400 700", style: "normal" },
    { path: "../../fonts/playfair-display-latin-italic-400-700.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-playfair",
  display: "swap",
});

const workSans = localFont({
  src: "../../fonts/work-sans-latin-normal-300-600.woff2",
  weight: "300 600",
  variable: "--font-work-sans",
  display: "swap",
});

export async function generateMetadata() {
  const meta = await getPageMetadata("ivory-lane", {
    title: "Ivory Lane Photography | Timeless Wedding Photography",
    description:
      "Editorial, light-filled wedding photography that tells the real story of your day. Now booking a limited number of weddings each year.",
    path: "/landing-pages/ivory-lane",
  });
  // Fictional demo brand for portfolio purposes, not a real business — never index.
  return { ...meta, robots: buildRobotsMeta(false) };
}

export default async function IvoryLaneLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${playfair.variable} ${workSans.variable}`}>
      <IvoryLaneLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
