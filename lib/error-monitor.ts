import prisma from "@/lib/prisma";
import { sendErrorAlertNotification } from "@/lib/email";

// Same role LinkCheckRun/ScheduledJob play for their own domains — this is
// the project's error-monitoring sink, used instead of a Sentry SDK (see
// the model comment on ErrorLog in prisma/schema.prisma for why). Called
// from instrumentation.ts (server-side) and app/api/internal/client-error
// (client-side).

const ALERT_WINDOW_MS = 30 * 60 * 1000; // don't re-alert on the same error more than once per 30 min
const MAX_STORED_LENGTH = 4000;

function truncate(value: string | null | undefined, max = MAX_STORED_LENGTH) {
  if (!value) return value ?? null;
  return value.length > max ? value.slice(0, max) + "…[truncated]" : value;
}

// Cheap string hash (not cryptographic — just needs to collide on
// "same error, same place" for dedup purposes) so we don't pull in a hashing
// dependency for this.
function fingerprintOf(message: string, path: string | null) {
  const input = `${path ?? ""}::${message}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export async function captureError(params: {
  message: string;
  stack?: string | null;
  path?: string | null;
  digest?: string | null;
  source: "server" | "client";
}) {
  try {
    const message = truncate(params.message, 500) || "Unknown error";
    const fingerprint = fingerprintOf(message, params.path ?? null);

    await prisma.errorLog.create({
      data: {
        fingerprint,
        message,
        stack: truncate(params.stack ?? null),
        path: params.path ?? null,
        digest: params.digest ?? null,
        source: params.source,
      },
    });

    const recentSameError = await prisma.errorLog.count({
      where: {
        fingerprint,
        createdAt: { gte: new Date(Date.now() - ALERT_WINDOW_MS) },
      },
    });

    // Alert on the first occurrence of a fingerprint in the window only —
    // every subsequent occurrence within it is still logged above, just not
    // re-emailed, so an incident that throws on every request doesn't turn
    // into hundreds of emails.
    if (recentSameError === 1) {
      const settings = await prisma.siteSetting.findFirst();
      await sendErrorAlertNotification({
        message,
        path: params.path ?? null,
        source: params.source,
        notifyEmail: settings?.email,
      });
    }
  } catch (captureFailure) {
    // Never let the error monitor itself be a source of unhandled errors —
    // it's already running from inside an error-handling path.
    console.error("captureError failed:", captureFailure);
  }
}

export async function getErrorLogHistory(limit = 50) {
  return prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
