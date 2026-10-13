import prisma from "@/lib/prisma";
import { sendUptimeAlertNotification } from "@/lib/email";

// Persists the result of an external probe that already happened in CI
// (see .github/workflows/uptime-check.yml) and alerts only on a state
// *change* (up -> down or down -> up) rather than on every failed probe —
// this runs every 5 minutes, so alerting on every failure during a real
// outage would mean an email every 5 minutes for the whole incident.
export async function recordUptimeCheck(params: {
  up: boolean;
  statusCode?: number | null;
  contentOk?: boolean;
  latencyMs?: number | null;
  error?: string | null;
}) {
  const previous = await prisma.uptimeCheck.findFirst({ orderBy: { checkedAt: "desc" } });
  const healthy = params.up && (params.contentOk ?? true);
  const previousHealthy = previous ? previous.up && previous.contentOk : true; // assume healthy before any history exists

  const check = await prisma.uptimeCheck.create({
    data: {
      up: params.up,
      statusCode: params.statusCode ?? null,
      contentOk: params.contentOk ?? true,
      latencyMs: params.latencyMs ?? null,
      error: params.error ?? null,
    },
  });

  if (healthy !== previousHealthy) {
    const settings = await prisma.siteSetting.findFirst();
    await sendUptimeAlertNotification({
      recovered: healthy,
      statusCode: params.statusCode ?? null,
      contentOk: params.contentOk ?? true,
      error: params.error ?? null,
      notifyEmail: settings?.email,
    });
  }

  return check;
}

export async function getUptimeHistory(limit = 50) {
  return prisma.uptimeCheck.findMany({ orderBy: { checkedAt: "desc" }, take: limit });
}
