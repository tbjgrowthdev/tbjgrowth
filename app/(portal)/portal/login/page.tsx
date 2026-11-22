import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { portalStrings } from "@/lib/portal/strings";
import { getClientContextFromToken } from "@/lib/portal/auth";
import { CLIENT_SESSION_COOKIE } from "@/lib/portal/session-cookie";
import { safePortalPath } from "@/lib/portal/paths";
import PortalLoginForm from "@/components/Portal/PortalLoginForm";

// Client Hub sign-in. Open to everyone. A client whose session is valid in the
// database goes on to /portal; middleware deliberately doesn't do this (it
// can't see revocation, see lib/route-gate.ts). Language: ?lang=bn, otherwise English; after sign-in the
// client's own saved language applies.
export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ lang?: string; from?: string }> }) {
  const { lang, from } = await searchParams;
  const next = safePortalPath(from) ?? "/portal";
  const jar = await cookies();
  if (await getClientContextFromToken(jar.get(CLIENT_SESSION_COOKIE)?.value)) redirect(next);
  const language = lang === "bn" ? "bn" : "en";
  return (
    <div lang={language} className="admin-canvas flex min-h-dvh items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
      <PortalLoginForm language={language} t={portalStrings(language)} next={next} />
    </div>
  );
}
