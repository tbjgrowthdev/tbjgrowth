import { Smartphone } from "lucide-react";
import { getPageMetadata } from "@/lib/seo-meta";
import { resolveRouteLocale } from "@/lib/i18n";
import { getClientApk } from "@/lib/mobile-app";
import InstallGuides from "./InstallGuides";

// Public "Get the app" page: the client Android app (TBJ Growth Tech) as an
// APK from R2, plus "Add to Home Screen" steps for iPhone (the site is an
// installable PWA, app/manifest.ts). The admin app is NOT offered here; it
// is downloaded from /admin/app by signed-in staff.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: localeParam } = await params;
  const locale = resolveRouteLocale(localeParam);
  return getPageMetadata(
    "app",
    {
      title: "Get the TBJ Growth Tech App | Android & iPhone",
      description: "Download the TBJ Growth Tech app for Android, or add the site to your iPhone Home Screen. Step-by-step install guide.",
      path: "/app",
    },
    locale?.code
  );
}

export default function AppDownloadPage() {
  const { url, version } = getClientApk();

  return (
    <div className="relative bg-background">
      <section className="relative pt-32 lg:pt-40 pb-12 lg:pb-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-brand-orange/10 pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cream to-ivory dark:from-brand-orange/10 dark:to-brand-orange-light/10 border border-brand-orange/20 rounded-full mb-6">
            <Smartphone className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
            <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">Mobile app</span>
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight">
            For TBJ clients:{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">track your project</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto">
            The TBJ Growth Tech app is our client portal: project progress and updates, approvals, monthly reports, invoices and meetings, with
            notifications. Sign in with the email your account manager invited.
          </p>
        </div>
      </section>

      <section className="relative pb-20 lg:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <InstallGuides apkUrl={url} version={version} />
        </div>
      </section>
    </div>
  );
}
