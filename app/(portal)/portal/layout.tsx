import type { Metadata, Viewport } from "next";
import "../../admin.css";
import "../../portal.css";
import { CLIENT_LOCK_INIT_SCRIPT } from "@/lib/native-lock";

// TBJ Client Hub. Every /portal page is private: never indexed, never
// prerendered (all of it is per-client and behind the client session).
export const metadata: Metadata = {
  title: "TBJ Client Hub",
  robots: { index: false, follow: false, nocache: true },
};

// The client app draws under the status bar; the portal pads for it itself
// (app/portal.css uses env(safe-area-inset-*)).
export const viewport: Viewport = {
  themeColor: "#E2571F",
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

// `admin-shell` opts into the TBJ brand tokens from app/admin.css (the same
// ones the staff login uses). No link in the portal leads to the public site.
export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell portal-shell">
      {/* Client app with the app lock on: hide the portal before paint until unlocked (lib/native-lock.ts). */}
      <script dangerouslySetInnerHTML={{ __html: CLIENT_LOCK_INIT_SCRIPT }} />
      {children}
    </div>
  );
}
