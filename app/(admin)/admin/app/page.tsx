import Link from "next/link";
import { Download, Bell, ShieldCheck, Smartphone, Settings2, AlertCircle } from "lucide-react";
import PageTitle from "@/components/Admin/PageTitle";
import { requireSession } from "@/lib/auth-guard";
import { ADMIN_APK_DOWNLOAD_PATH, getAdminApkInfo } from "@/lib/mobile-app";

// /admin/app: download page for the TBJ Admin Android app. The APK is served
// by /api/admin/app-download from a private R2 bucket, so the link only works
// for a signed-in admin. Every role can use the app.
export default async function AdminAppPage() {
  await requireSession();
  const apk = await getAdminApkInfo();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <PageTitle>TBJ Admin app</PageTitle>
        <p className="text-caption">The admin panel on your Android phone, with notifications for new leads, bookings and content waiting for approval.</p>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Smartphone size={22} className="text-brand-orange-deep" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Android</h2>
            <p className="text-sm text-caption">
              {apk ? `Version ${apk.version} · ${apk.sizeMb} MB` : "Not uploaded yet: ask a Super Admin to upload the latest build."}
            </p>
          </div>
        </div>

        {apk ? (
          // A plain <a>, not <Link>: this is a file download from an API route.
          <a
            href={ADMIN_APK_DOWNLOAD_PATH}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 bg-brand-orange-deep text-white rounded-lg font-semibold hover:bg-brand-orange transition-colors"
          >
            <Download size={18} />
            Download TBJ Admin
          </a>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-background p-3 text-sm text-muted">
            <AlertCircle size={16} className="mt-0.5 flex-none" />
            The download appears here once the APK is in the private app bucket (see mobile/README.md).
          </p>
        )}

        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted marker:font-semibold marker:text-foreground">
          <li>
            Open this page on your Android phone and tap <strong>Download TBJ Admin</strong>, then open the downloaded file.
          </li>
          <li>
            If Android says installing from this source isn&apos;t allowed, tap <strong>Settings</strong>, turn on{" "}
            <strong>Allow from this source</strong> for your browser (e.g. Chrome), go back and tap <strong>Install</strong>.
            <span className="mt-1 flex items-start gap-1.5 text-caption">
              <Settings2 size={14} className="mt-0.5 flex-none" />
              Some phones keep this under Settings → Apps → Special app access → Install unknown apps.
            </span>
          </li>
          <li>Open <strong>TBJ Admin</strong> and sign in with your usual email, password and 2FA code.</li>
          <li>
            Tap <strong>Allow</strong> when it asks to send notifications.
          </li>
        </ol>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-caption" />
            <h2 className="font-bold text-foreground">Choose your alerts</h2>
          </div>
          <p className="text-sm text-muted">
            Pick which notifications you get in{" "}
            <Link href="/admin/profile" className="text-brand-orange-deep underline underline-offset-2">My Profile → Notifications</Link>.
            They never show client details on your lock screen.
          </p>
        </div>
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-caption" />
            <h2 className="font-bold text-foreground">Locked when you&apos;re away</h2>
          </div>
          <p className="text-sm text-muted">
            The app asks for your fingerprint, face or phone PIN when it opens and after 5 minutes in the background. Logging out
            stops notifications on that phone.
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-4 sm:p-6 space-y-2">
        <h2 className="font-bold text-foreground">iPhone</h2>
        <p className="text-sm text-muted">
          There&apos;s no iPhone app yet. Open <strong>tbjgrowthtech.com/admin</strong> in Safari, tap <strong>Share</strong> →{" "}
          <strong>Add to Home Screen</strong>. Notifications aren&apos;t available on iPhone yet.
        </p>
      </div>
    </div>
  );
}
