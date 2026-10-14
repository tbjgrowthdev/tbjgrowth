import type { NextConfig } from "next";
import path from "path";

// Next.js's own hydration bootstrap and framer-motion's inline style
// attributes both need 'unsafe-inline' for script-src/style-src — this app
// has no nonce plumbing (would mean threading a per-request nonce through
// middleware.ts, which is already doing a lot of locale/redirect/auth logic
// in the one Edge function Cloudflare allows — see its own comments). The
// directives that actually stop the attacks in scope here (data
// exfiltration via connect-src, clickjacking via frame-ancestors, base tag
// hijacking) don't depend on script-src being strict, so this is the
// standard real-world shape for a Next.js app without nonce infrastructure,
// not a weakened placeholder.
//
// 'unsafe-eval' is added to script-src in development ONLY: React's dev
// mode uses eval() for debugging features (reconstructing call stacks
// across the RSC boundary) and errors loudly without it — the error
// literally says "React will never use eval() in production mode," so
// production stays without it.
const isDev = process.env.NODE_ENV !== "production";
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://picsum.photos https://images.unsplash.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["pg", "pg-cloudflare"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    cpus: 1,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
