

import type { Metadata } from "next";
// Self-hosted (app/fonts/, Google Fonts files under the SIL Open Font License)
// instead of the Google font loader, whose build-time download intermittently
// breaks Turbopack builds — see app/(public)/[locale]/layout.tsx.
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = localFont({
  src: "./fonts/inter-latin-normal-100-900.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const syne = localFont({
  src: "./fonts/syne-latin-normal-400-800.woff2",
  weight: "400 800",
  variable: "--font-syne",
  display: "swap",
});

// Admin-only brand fonts (Manrope body/eyebrows, Instrument Serif Italic accent
// word). Self-hosted like the two above; preload is off so public pages don't
// fetch them - the @font-face only downloads once an admin screen uses it.
const manrope = localFont({
  src: "./fonts/manrope-latin-normal-300-800.woff2",
  weight: "300 800",
  variable: "--font-manrope",
  display: "swap",
  preload: false,
});

const instrumentSerif = localFont({
  src: "./fonts/instrument-serif-latin-italic-400.ttf",
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "TBJ Growth | AI-Powered Digital Growth Agency",
  description: "Experience the complete business growth journey with TBJ Growth: Build, Attract, Convert, Automate, Scale.",
  verification: {
    google: "JOr0NxVw6eA8AXIKlo9_xiOVn-pkbgzn51iI2Fni6Ao",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${syne.variable} ${manrope.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-full flex flex-col font-body antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}