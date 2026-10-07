import { Playfair_Display, Work_Sans } from "next/font/google";
import { getPageMetadata, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import IvoryLaneLandingClient from "./IvoryLaneLandingClient";

// Scoped to this page only — a warm, editorial, romantic identity independent
// of the rest of the site and of the other /landing-pages/* pages.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-work-sans",
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
