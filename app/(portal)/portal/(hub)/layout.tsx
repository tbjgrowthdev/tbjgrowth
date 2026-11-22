import PortalHeader from "@/components/Portal/PortalHeader";
import TabBar from "@/components/Portal/TabBar";
import { requireClientPage } from "@/lib/portal/page-guard";
import { portalStrings } from "@/lib/portal/strings";

// Signed-in portal pages: header, content, bottom tab bar. middleware.ts has
// already checked the cookie's signature; this checks the session row too
// (revoked, disabled user) before anything renders. Each page still calls
// requireClientPage() itself, because layouts and pages render in parallel.
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireClientPage();
  const t = portalStrings(ctx.language);
  return (
    <div lang={ctx.language}>
      <PortalHeader title={t.appName} brand={t.brand} />
      <main className="portal-main mx-auto max-w-3xl pt-5">{children}</main>
      <TabBar labels={t.tabs} />
    </div>
  );
}
