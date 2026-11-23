"use server";

import { z } from "zod";
import { requireClient, ClientAuthError } from "@/lib/portal/auth";
import { clientPushPreferences, registerClientDevice, saveClientPushPreference, unregisterClientDevice, CLIENT_PUSH_EVENTS, type ClientPushEventName } from "@/lib/portal/push-devices";

// Push for the TBJ Growth Tech app: device registration (called by the
// native bridge after sign-in) and the client's notification settings on
// /portal/more. All scoped to the session's client user.

const registerSchema = z.object({ token: z.string().trim().min(1).max(4096), platform: z.enum(["android", "web"]) });

type Ok = { success: true };
type Fail = { success: false; error: "signed_out" | "invalid" | "failed" };

function fail(error: unknown, label: string): Fail {
  if (error instanceof ClientAuthError) return { success: false, error: "signed_out" };
  console.error(`[portal] ${label} failed:`, error);
  return { success: false, error: "failed" };
}

export async function registerClientPushDevice(data: { token: string; platform: "android" | "web" }): Promise<Ok | Fail> {
  try {
    const ctx = await requireClient();
    const parsed = registerSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "invalid" };
    await registerClientDevice(ctx, parsed.data.token, parsed.data.platform);
    return { success: true };
  } catch (error) {
    return fail(error, "registerClientPushDevice");
  }
}

export async function unregisterClientPushDevice(token: string): Promise<Ok | Fail> {
  try {
    const ctx = await requireClient();
    if (typeof token !== "string" || !token) return { success: false, error: "invalid" };
    await unregisterClientDevice(ctx, token);
    return { success: true };
  } catch (error) {
    return fail(error, "unregisterClientPushDevice");
  }
}

export async function getClientPushPreferences(): Promise<{ success: true; preferences: Array<{ event: ClientPushEventName; enabled: boolean }> } | (Fail & { preferences: [] })> {
  try {
    const ctx = await requireClient();
    return { success: true, preferences: await clientPushPreferences(ctx) };
  } catch (error) {
    return { ...fail(error, "getClientPushPreferences"), preferences: [] };
  }
}

export async function setClientPushPreference(event: ClientPushEventName, enabled: boolean): Promise<Ok | Fail> {
  try {
    const ctx = await requireClient();
    if (!(CLIENT_PUSH_EVENTS as readonly string[]).includes(event) || typeof enabled !== "boolean") return { success: false, error: "invalid" };
    await saveClientPushPreference(ctx, event, enabled);
    return { success: true };
  } catch (error) {
    return fail(error, "setClientPushPreference");
  }
}
