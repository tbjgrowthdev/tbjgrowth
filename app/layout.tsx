

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

export const metadata: Metadata = {
  title: "TBJ Growth | AI-Powered Digital Growth Agency",
  description: "Experience the complete business growth journey with TBJ Growth: Build, Attract, Convert, Automate, Scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${syne.variable}`}>
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