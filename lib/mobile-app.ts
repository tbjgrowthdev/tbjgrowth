import { getCloudflareContext } from "@opennextjs/cloudflare";

// Where the two Android apps (mobile/README.md) are downloaded from.
//
//  - TBJ Growth Tech (client): a public file on R2 (bucket "tbj-downloads",
//    custom domain downloads.tbjgrowthtech.com), linked from /app.
//  - TBJ Admin: a private object in the R2 bucket bound as APP_BUILDS
//    (wrangler.jsonc), streamed only to signed-in admins by
//    app/api/admin/app-download/route.ts and linked from /admin/app.

export const DEFAULT_CLIENT_APK_URL = "https://downloads.tbjgrowthtech.com/tbj-growth-tech.apk";
export const ADMIN_APK_KEY = "tbj-admin.apk";
export const ADMIN_APK_DOWNLOAD_PATH = "/api/admin/app-download";

/** Public client-app APK link. NEXT_PUBLIC_ANDROID_APK_URL overrides it, but only with an https URL. */
export function getClientApk(): { url: string; version: string | null } {
  const configured = process.env.NEXT_PUBLIC_ANDROID_APK_URL;
  let url = DEFAULT_CLIENT_APK_URL;
  if (configured) {
    try {
      if (new URL(configured).protocol === "https:") url = configured;
    } catch {
      /* not a URL: keep the default */
    }
  }
  return { url, version: process.env.NEXT_PUBLIC_ANDROID_APP_VERSION || null };
}

export type R2ObjectLike = {
  body: ReadableStream;
  size: number;
  uploaded?: Date;
  customMetadata?: Record<string, string>;
};
type AppBuildsBucket = {
  get(key: string): Promise<R2ObjectLike | null>;
  head(key: string): Promise<Omit<R2ObjectLike, "body"> | null>;
};

/** The private APK bucket, or null outside Cloudflare (next dev) or if the binding is missing. */
export function getAppBuildsBucket(): AppBuildsBucket | null {
  try {
    return ((getCloudflareContext().env as unknown as { APP_BUILDS?: AppBuildsBucket }).APP_BUILDS ?? null) as AppBuildsBucket | null;
  } catch {
    return null;
  }
}

/** A version label safe to put in a filename ("1.0.3"), else "latest". */
export function apkVersionLabel(metadata: Record<string, string> | undefined): string {
  const v = metadata?.version;
  return v && /^[0-9A-Za-z.\-]{1,32}$/.test(v) ? v : "latest";
}

/** Shown on /admin/app: whether the admin APK is uploaded, and its version/size. */
export async function getAdminApkInfo(): Promise<{ version: string; sizeMb: string; uploaded: Date | null } | null> {
  const bucket = getAppBuildsBucket();
  if (!bucket) return null;
  try {
    const head = await bucket.head(ADMIN_APK_KEY);
    if (!head) return null;
    return { version: apkVersionLabel(head.customMetadata), sizeMb: (head.size / 1024 / 1024).toFixed(1), uploaded: head.uploaded ?? null };
  } catch (error) {
    console.error("Failed to read admin APK info:", error);
    return null;
  }
}
