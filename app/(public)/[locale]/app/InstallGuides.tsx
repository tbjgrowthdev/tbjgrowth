"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Share, PlusSquare, ShieldCheck, Settings2 } from "lucide-react";

// Both guides are server-rendered (and indexable); on a phone the one for
// that phone is moved first. The detection is only a convenience.
export default function InstallGuides({ apkUrl, version }: { apkUrl: string; version: string | null }) {
  const [platform, setPlatform] = useState<"android" | "ios" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the user agent is only possible after hydration
    setPlatform(isIos ? "ios" : /Android/i.test(ua) ? "android" : "other");
  }, []);

  const android = (
    <section key="android" aria-labelledby="android-title" className="bg-card rounded-3xl border border-border shadow-xl p-6 sm:p-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange-deep dark:text-brand-orange-light">
          <Smartphone className="h-6 w-6" />
        </span>
        <div>
          <h2 id="android-title" className="text-2xl font-bold text-foreground">Android</h2>
          <p className="text-sm text-caption">TBJ Growth Tech app{version ? ` · version ${version}` : ""}</p>
        </div>
      </div>

      <a
        href={apkUrl}
        download
        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 min-h-12 px-6 py-3 rounded-full bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold shadow-lg hover:opacity-95 transition-opacity"
      >
        <Download className="h-5 w-5" />
        Download for Android
      </a>

      <ol className="mt-8 space-y-5">
        <Step n={1} title="Download and open the file">
          Tap <strong>Download for Android</strong>. When it finishes, tap the downloaded file (or open it from your
          notifications or the Downloads folder).
        </Step>
        <Step n={2} title="Allow installs from your browser (first time only)">
          If Android says installing from this source isn&apos;t allowed, tap <strong>Settings</strong>, turn on{" "}
          <strong>Allow from this source</strong> for your browser (for example Chrome), then go back and tap{" "}
          <strong>Install</strong>.
          <span className="mt-2 flex items-start gap-2 text-sm text-caption">
            <Settings2 className="mt-0.5 h-4 w-4 flex-none" />
            On some phones this is under Settings → Apps → Special app access → Install unknown apps.
          </span>
        </Step>
        <Step n={3} title="Open TBJ Growth Tech">
          Find the app on your home screen or in your app list.
        </Step>
      </ol>

      <p className="mt-8 flex items-start gap-2 rounded-2xl bg-background p-4 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-green-600" />
        <span>
          The app opens this website, so updates to the site appear in the app automatically. You only need to
          reinstall when we announce a new app version. Download it only from this page.
        </span>
      </p>
    </section>
  );

  const ios = (
    <section key="ios" aria-labelledby="ios-title" className="bg-card rounded-3xl border border-border shadow-xl p-6 sm:p-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange/10 text-brand-orange-deep dark:text-brand-orange-light">
          <PlusSquare className="h-6 w-6" />
        </span>
        <div>
          <h2 id="ios-title" className="text-2xl font-bold text-foreground">iPhone and iPad</h2>
          <p className="text-sm text-caption">Add the site to your Home Screen. No App Store needed.</p>
        </div>
      </div>
      <ol className="space-y-5">
        <Step n={1} title="Open tbjgrowthtech.com in Safari">
          It has to be Safari for this step.
        </Step>
        <Step n={2} title="Tap the Share button">
          <span className="inline-flex items-center gap-1">
            The square with an arrow <Share className="inline h-4 w-4" aria-label="Share icon" />, at the bottom of the screen (top right on iPad).
          </span>
        </Step>
        <Step n={3} title="Tap “Add to Home Screen”, then “Add”">
          Scroll down the share menu if you don&apos;t see it. TBJ Growth Tech then opens from your Home Screen like an app.
        </Step>
      </ol>
    </section>
  );

  return <div className="grid gap-8 lg:grid-cols-2 lg:items-start">{platform === "ios" ? [ios, android] : [android, ios]}</div>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-orange-deep text-sm font-bold text-white">{n}</span>
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{title}</p>
        <div className="mt-1 text-muted leading-relaxed">{children}</div>
      </div>
    </li>
  );
}
