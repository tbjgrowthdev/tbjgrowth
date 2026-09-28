import { Tiro_Bangla, Hind_Siliguri } from "next/font/google";
import { getPageMetadata } from "@/lib/seo-meta";
import { getSiteSettings } from "@/app/(admin)/actions/settings";
import DateGurLandingClient from "./DateGurLandingClient";

// Scoped to this page only. Fraunces/Inter (used elsewhere on the page and
// across the rest of the site) don't have Bengali glyphs at all, so this
// page needs its own Bengali-script font pairing: Tiro Bangla for the
// literary display serif headings, Hind Siliguri for readable Bangla body copy.
const tiroBangla = Tiro_Bangla({
  subsets: ["bengali"],
  weight: "400",
  variable: "--font-tiro-bangla",
});

const hindSiliguri = Hind_Siliguri({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind-siliguri",
});

export async function generateMetadata() {
  return getPageMetadata("date-gur", {
    title: "নলেন — খাঁটি খেজুরের গুড়, মোলাসেস ও খেজুর চিনি",
    description:
      "বাংলাদেশে ঐতিহ্যবাহী গাছি পরিবারের হাতে সংগ্রহ করা ১০০% প্রাকৃতিক, ভেজালমুক্ত খেজুরের গুড়। পাটালি গুড়, ঝোলা গুড় ও খেজুর চিনি অর্ডার করুন।",
    path: "/landing-pages/date-gur",
  });
}

export default async function DateGurLandingPage() {
  const settings = await getSiteSettings();
  return (
    <div className={`${tiroBangla.variable} ${hindSiliguri.variable}`}>
      <DateGurLandingClient phone={settings?.phone} email={settings?.email} />
    </div>
  );
}
