import { portalStrings } from "@/lib/portal/strings";
import { safePortalPath } from "@/lib/portal/paths";
import PortalLoginForm from "@/components/Portal/PortalLoginForm";

// Client Hub sign-in. Open to everyone (middleware.ts sends signed-in clients
// on to /portal). Language: ?lang=bn, otherwise English; after sign-in the
// client's own saved language applies.
export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ lang?: string; from?: string }> }) {
  const { lang, from } = await searchParams;
  const language = lang === "bn" ? "bn" : "en";
  return (
    <div lang={language} className="admin-canvas flex min-h-dvh items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
      <PortalLoginForm language={language} t={portalStrings(language)} next={safePortalPath(from) ?? "/portal"} />
    </div>
  );
}
