import { requireSession, AuthError } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit-log";
import { ADMIN_APK_KEY, apkVersionLabel, getAppBuildsBucket } from "@/lib/mobile-app";

// TBJ Admin Android app download. The APK sits in a PRIVATE R2 bucket
// (APP_BUILDS) and is only handed to a signed-in admin: /api is outside
// middleware.ts, so this route checks the session itself (requireSession
// also refuses revoked sessions). Linked from /admin/app.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ error: "Sign in to download the admin app." }, { status: 401, headers: NO_STORE });
    }
    throw error;
  }

  const bucket = getAppBuildsBucket();
  const object = bucket ? await bucket.get(ADMIN_APK_KEY) : null;
  if (!object) {
    return Response.json({ error: "The admin app hasn't been uploaded yet." }, { status: 404, headers: NO_STORE });
  }

  const version = apkVersionLabel(object.customMetadata);
  await logAudit({ action: "download", category: "Settings", entityType: "AdminApp", entityLabel: `TBJ Admin ${version}` });

  return new Response(object.body, {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="tbj-admin-${version}.apk"`,
      "Content-Length": String(object.size),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
