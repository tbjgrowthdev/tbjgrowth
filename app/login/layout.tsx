import type { Metadata } from "next";

// The login page is a client component and can't export metadata itself —
// this layout is the only way to attach noindex to it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
