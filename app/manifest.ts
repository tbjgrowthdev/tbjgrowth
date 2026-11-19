import type { MetadataRoute } from "next";

// Web app manifest, served at /manifest.webmanifest. Makes the public site
// installable ("Add to Home Screen" on iPhone, "Install app" on Android).
// The service worker that pairs with it is public/sw.js.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TBJ Growth Tech",
    short_name: "TBJ",
    description: "Technology built for growth: web, marketing, automation and SEO.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FDFBFA",
    theme_color: "#E2571F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
