import type { Metadata } from "next";
import "../admin.css";

// The login page is a client component and can't export metadata itself —
// this layout is the only way to attach noindex to it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// `admin-shell` opts this screen into the admin theme tokens (see app/admin.css).
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell min-h-screen">{children}</div>;
}
