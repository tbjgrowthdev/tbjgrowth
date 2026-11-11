// Fonts the admin can pick for the public website (Settings → Typography).
//
// Pure data, safe to import from client components. The actual @font-face
// loading lives in app/site-fonts.ts (next/font can't be imported client-side);
// every `cssVar` here must match a `variable` declared there or in
// app/layout.tsx.
//
// Four independent choices are stored on SiteSetting, one per role and script:
//   headingFont / bodyFont      -> Latin fonts   (script "latin")
//   headingFontBn / bodyFontBn  -> Bengali fonts (script "bengali")
// The browser picks a font per character, so the Latin choice only ever draws
// Latin text and the Bengali choice only ever draws Bengali text.
//
// Only keys from this list are ever emitted into the page's CSS, so a value
// that was tampered with can never inject CSS — see normalizeFontKey.

export type FontScript = "latin" | "bengali";
export type FontRole = "heading" | "body";

export type SiteFont = {
  key: string;
  label: string;
  cssVar: string;
  script: FontScript;
  generic: "sans-serif" | "serif";
  // Single-weight or decorative face: offered for headings only.
  headingOnly?: boolean;
};

export const SITE_FONTS: SiteFont[] = [
  // Latin
  { key: "inter", label: "Inter", cssVar: "--font-inter", script: "latin", generic: "sans-serif" },
  { key: "syne", label: "Syne", cssVar: "--font-syne", script: "latin", generic: "sans-serif" },
  { key: "manrope", label: "Manrope", cssVar: "--font-manrope", script: "latin", generic: "sans-serif" },
  { key: "jost", label: "Jost", cssVar: "--font-jost", script: "latin", generic: "sans-serif" },
  { key: "work-sans", label: "Work Sans", cssVar: "--font-work-sans", script: "latin", generic: "sans-serif" },
  { key: "playfair-display", label: "Playfair Display", cssVar: "--font-playfair", script: "latin", generic: "serif" },
  { key: "cormorant-garamond", label: "Cormorant Garamond", cssVar: "--font-cormorant", script: "latin", generic: "serif" },
  { key: "anton", label: "Anton (display)", cssVar: "--font-anton", script: "latin", generic: "sans-serif", headingOnly: true },
  // Bengali
  { key: "noto-sans-bengali", label: "Noto Sans Bengali", cssVar: "--font-bn", script: "bengali", generic: "sans-serif" },
  { key: "hind-siliguri", label: "Hind Siliguri", cssVar: "--font-hind", script: "bengali", generic: "sans-serif" },
  { key: "anek-bangla", label: "Anek Bangla", cssVar: "--font-anek", script: "bengali", generic: "sans-serif" },
  { key: "noto-serif-bengali", label: "Noto Serif Bengali", cssVar: "--font-bn-serif", script: "bengali", generic: "serif" },
  { key: "baloo-da-2", label: "Baloo Da 2 (rounded)", cssVar: "--font-baloo", script: "bengali", generic: "sans-serif", headingOnly: true },
  { key: "tiro-bangla", label: "Tiro Bangla (serif)", cssVar: "--font-tiro", script: "bengali", generic: "serif", headingOnly: true },
];

// What the site used before any choice existed: Syne / Inter for Latin, and
// Noto Sans Bengali (always in the stack) for Bengali.
export const DEFAULT_FONT: Record<FontScript, Record<FontRole, string>> = {
  latin: { heading: "syne", body: "inter" },
  bengali: { heading: "noto-sans-bengali", body: "noto-sans-bengali" },
};

const BY_KEY = new Map(SITE_FONTS.map((f) => [f.key, f]));

export function getSiteFont(key: string | null | undefined): SiteFont | undefined {
  return key ? BY_KEY.get(key) : undefined;
}

export function fontsFor(script: FontScript, role: FontRole): SiteFont[] {
  return SITE_FONTS.filter((f) => f.script === script && (role === "heading" || !f.headingOnly));
}

// Returns the key if it is a known font of that script allowed for that role,
// otherwise null (null = use the site default).
export function normalizeFontKey(key: unknown, role: FontRole, script: FontScript = "latin"): string | null {
  if (typeof key !== "string") return null;
  const font = BY_KEY.get(key);
  if (!font || font.script !== script || (role === "body" && font.headingOnly)) return null;
  return font.key;
}

// font-family value for a role: the chosen (or default) Latin font, then the
// chosen (or default) Bengali font, then Inter, Noto Sans Bengali and Noto
// Arabic as always-on safety nets, so Bengali/Arabic text is always drawn with
// a bundled font and never falls to a system font. Browsers only download a
// face when a character actually needs it.
export function buildFontStack(latinKey: string | null | undefined, bengaliKey: string | null | undefined, role: FontRole): string {
  const latin = BY_KEY.get(normalizeFontKey(latinKey, role, "latin") ?? DEFAULT_FONT.latin[role])!;
  const bengali = BY_KEY.get(normalizeFontKey(bengaliKey, role, "bengali") ?? DEFAULT_FONT.bengali[role])!;
  const vars = [latin.cssVar, bengali.cssVar, "--font-inter", "--font-bn", "--font-ar"];
  const generic = latin.generic;
  return [...new Set(vars)].map((v) => `var(${v})`).join(", ") + `, ${generic}`;
}

export type SiteFontChoices = {
  headingFont?: string | null;
  bodyFont?: string | null;
  headingFontBn?: string | null;
  bodyFontBn?: string | null;
};

// CSS that applies the chosen fonts site-wide. `html:root` outranks the plain
// :root defaults in globals.css regardless of stylesheet order.
export function siteFontCss(c: SiteFontChoices | null | undefined): string {
  return `html:root{--font-heading:${buildFontStack(c?.headingFont, c?.headingFontBn, "heading")};--font-body:${buildFontStack(c?.bodyFont, c?.bodyFontBn, "body")};}`;
}
