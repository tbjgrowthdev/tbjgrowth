// Self-hosted (app/fonts/, Google Fonts files under the SIL Open Font License)
// instead of the Google font loader, whose build-time download intermittently
// breaks Turbopack builds — see app/(public)/[locale]/layout.tsx.
import localFont from "next/font/local";
import { getPageMetadata, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import CedarCoveLandingClient from "./CedarCoveLandingClient";

// Scoped to this page only — its own boutique-lodge identity, independent
// of the rest of the site (and of the other landing pages under
// /landing-pages/*, which each bring their own typography and theme too).
const cormorant = localFont({
  src: "../../fonts/cormorant-garamond-latin-normal-400-700.woff2",
  weight: "400 700",
  variable: "--font-cormorant",
  display: "swap",
});

const jost = localFont({
  src: "../../fonts/jost-latin-normal-300-600.woff2",
  weight: "300 600",
  variable: "--font-jost",
  display: "swap",
});

export async function generateMetadata() {
  const meta = await getPageMetadata("cedar-cove", {
    title: "Cedar Cove Resort & Cottages | A Quiet Escape by the Water",
    description:
      "Private lakeside cottages, forest trails, and a slower pace of life. Book your stay at Cedar Cove Resort & Cottages.",
    path: "/landing-pages/cedar-cove",
  });
  // Fictional demo brand for portfolio purposes, not a real business — never index.
  return { ...meta, robots: buildRobotsMeta(false) };
}

export default async function CedarCoveLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${cormorant.variable} ${jost.variable}`}>
      <CedarCoveLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
