// Self-hosted (app/fonts/, Google Fonts files under the SIL Open Font License)
// instead of the Google font loader, whose build-time download intermittently
// breaks Turbopack builds — see app/(public)/[locale]/layout.tsx.
import localFont from "next/font/local";
import { getPageMetadata, buildRobotsMeta } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import DateGurLandingClient from "./DateGurLandingClient";

// Scoped to this page only. Fraunces/Inter (used elsewhere on the page and
// across the rest of the site) don't have Bengali glyphs at all, so this
// page needs its own Bengali-script font pairing: Tiro Bangla for the
// literary display serif headings, Hind Siliguri for readable Bangla body copy.
const tiroBangla = localFont({
  src: "../../fonts/tiro-bangla-bengali-normal-400.woff2",
  weight: "400",
  variable: "--font-tiro-bangla",
  display: "swap",
});

const hindSiliguri = localFont({
  src: [
    { path: "../../fonts/hind-siliguri-bengali-normal-400.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/hind-siliguri-bengali-normal-500.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/hind-siliguri-bengali-normal-600.woff2", weight: "600", style: "normal" },
    { path: "../../fonts/hind-siliguri-bengali-normal-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-hind-siliguri",
  display: "swap",
});

export async function generateMetadata() {
  const meta = await getPageMetadata("date-gur", {
    title: "নলেন — খাঁটি খেজুরের গুড়, মোলাসেস ও খেজুর চিনি",
    description:
      "বাংলাদেশে ঐতিহ্যবাহী গাছি পরিবারের হাতে সংগ্রহ করা ১০০% প্রাকৃতিক, ভেজালমুক্ত খেজুরের গুড়। পাটালি গুড়, ঝোলা গুড় ও খেজুর চিনি অর্ডার করুন।",
    path: "/landing-pages/date-gur",
  });
  // Fictional demo brand for portfolio purposes, not a real business — never index.
  return { ...meta, robots: buildRobotsMeta(false) };
}

export default async function DateGurLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${tiroBangla.variable} ${hindSiliguri.variable}`}>
      <DateGurLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
