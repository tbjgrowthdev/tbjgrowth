// Push to every device of a client company's portal users.
//
// Task 6 of docs/superpowers/plans/2026-11-22-client-hub.md calls this with
// its final signature; Task 10 fills it in (recipients by event and
// ClientPushPreference, generic copy from lib/push/messages.ts). Until then
// it sends nothing.
import type { PushEvent } from "@/lib/generated/prisma/client";

export type ClientPushEvent = Extract<PushEvent, `CLIENT_${string}`>;

export async function notifyClients(event: ClientPushEvent, clientId: string): Promise<void> {
  void event;
  void clientId;
}
