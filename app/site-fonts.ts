// @font-face loaders for the fonts offered in Settings → Typography
// (registry: lib/site-fonts.ts). Inter, Syne and Manrope are loaded in
// app/layout.tsx. Self-hosted for the same reason as there (see its header
// comment). preload is off: the browser only downloads a face when text on the
// page actually uses it, so unused choices cost nothing.
import localFont from "next/font/local";

const playfair = localFont({ src: "./fonts/playfair-display-latin-normal-400-700.woff2", weight: "400 700", variable: "--font-playfair", display: "swap", preload: false });
const cormorant = localFont({ src: "./fonts/cormorant-garamond-latin-normal-400-700.woff2", weight: "400 700", variable: "--font-cormorant", display: "swap", preload: false });
const jost = localFont({ src: "./fonts/jost-latin-normal-300-600.woff2", weight: "300 600", variable: "--font-jost", display: "swap", preload: false });
const workSans = localFont({ src: "./fonts/work-sans-latin-normal-300-600.woff2", weight: "300 600", variable: "--font-work-sans", display: "swap", preload: false });
const anton = localFont({ src: "./fonts/anton-latin-normal-400.woff2", weight: "400", variable: "--font-anton", display: "swap", preload: false });

// Bengali-only files (no Latin glyphs): Latin text falls through to Inter.
const hindSiliguri = localFont({
  src: [
    { path: "./fonts/hind-siliguri-bengali-normal-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-normal-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-normal-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/hind-siliguri-bengali-normal-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-hind",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

// More Bengali choices (Bengali glyphs only; Latin text uses the Latin font).
const anek = localFont({ src: "./fonts/anek-bangla-variable.woff2", weight: "400 800", variable: "--font-anek", display: "swap", preload: false, adjustFontFallback: false });
const notoSerifBengali = localFont({ src: "./fonts/noto-serif-bengali-variable.woff2", weight: "400 800", variable: "--font-bn-serif", display: "swap", preload: false, adjustFontFallback: false });
const baloo = localFont({ src: "./fonts/baloo-da-2-variable.woff2", weight: "400 800", variable: "--font-baloo", display: "swap", preload: false, adjustFontFallback: false });
const tiro = localFont({ src: "./fonts/tiro-bangla-bengali-normal-400.woff2", weight: "400", variable: "--font-tiro", display: "swap", preload: false, adjustFontFallback: false });

// Always part of every font stack (see buildFontStack), so Bengali/Arabic text
// never falls back to a system font on any page or locale.
const notoBengali = localFont({ src: "./fonts/noto-sans-bengali-variable.woff2", weight: "400 700", variable: "--font-bn", display: "swap", preload: false, adjustFontFallback: false });
const notoArabic = localFont({ src: "./fonts/noto-sans-arabic-variable.woff2", weight: "400 700", variable: "--font-ar", display: "swap", preload: false, adjustFontFallback: false });

export const siteFontVariables = [
  playfair, cormorant, jost, workSans, anton, hindSiliguri, anek, notoSerifBengali, baloo, tiro, notoBengali, notoArabic,
].map((f) => f.variable).join(" ");
