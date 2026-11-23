// Push to every device of a client company's portal users (TBJ Growth Tech
// app), in each user's language. Called through safeNotify
// (lib/clients/updates.ts) and the reminder cron (lib/clients/reminders.ts).
// Never throws: a push problem must never fail the change that caused it.
import prisma from "@/lib/prisma";
import type { PushEvent } from "@/lib/generated/prisma/client";
import { clientRecipientDevices } from "@/lib/push/recipients";
import { sendFcm } from "@/lib/push/fcm";
import { CLIENT_PUSH_MESSAGES } from "@/lib/push/messages";
import { safePortalPath } from "@/lib/portal/paths";

export type ClientPushEvent = Extract<PushEvent, `CLIENT_${string}`>;

export async function notifyClients(event: ClientPushEvent, clientId: string): Promise<void> {
  try {
    const devices = await clientRecipientDevices(event, clientId);
    if (devices.length === 0) return;
    const invalid: string[] = [];
    for (const language of ["en", "bn"] as const) {
      const tokens = devices.filter((d) => d.language === language).map((d) => d.token);
      if (tokens.length === 0) continue;
      const message = CLIENT_PUSH_MESSAGES[language][event];
      // Belt and braces: a push may only ever open a /portal page.
      const url = safePortalPath(message.url) ?? "/portal";
      const result = await sendFcm(tokens, { ...message, url });
      invalid.push(...result.invalidTokens);
    }
    if (invalid.length > 0) await prisma.pushDevice.deleteMany({ where: { token: { in: invalid } } });
  } catch (error) {
    console.error(`Client push "${event}" failed:`, error);
  }
}
