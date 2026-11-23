// Talking to the Android app shell (mobile/, Capacitor) from the live site.
//
// The apps load https://tbjgrowthtech.com itself, and Capacitor injects
// window.Capacitor (with every installed native plugin under .Plugins) into
// that page. So the site uses the plugins through this global; no Capacitor
// npm package is bundled into the website.
//
// Two apps share the shell (mobile/README.md): TBJ Admin
// (com.tbjgrowthtech.admin, /admin, staff push + biometric lock) and TBJ
// Growth Tech (com.tbjgrowthtech.app, the client portal /portal, client push
// + optional lock). Each app's behaviour must check its own app (isAdminApp,
// isClientApp / pushTargetFor), never just isNativeApp().
import { safePortalPath } from "@/lib/portal/paths";
import { ADMIN_UA_MARK, CLIENT_UA_MARK } from "@/lib/native-lock";

export { CLIENT_UA_MARK };
export const ADMIN_APP_ID = "com.tbjgrowthtech.admin";
export const CLIENT_APP_ID = "com.tbjgrowthtech.app";
export const PUSH_TOKEN_STORAGE_KEY = "tbj-push-token";

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
};

function capacitor(): CapacitorGlobal | null {
  const w = (globalThis as { window?: { Capacitor?: CapacitorGlobal } }).window;
  return w?.Capacitor ?? null;
}

export function isNativeApp(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function nativePlugin<T>(name: string): T | null {
  if (!isNativeApp()) return null;
  return (capacitor()?.Plugins?.[name] as T | undefined) ?? null;
}

export async function isAdminApp(): Promise<boolean> {
  const app = nativePlugin<{ getInfo: () => Promise<{ id: string }> }>("App");
  if (!app) return false;
  try {
    return (await app.getInfo()).id === ADMIN_APP_ID;
  } catch {
    return false;
  }
}

/**
 * Where tapping a push notification may navigate: a path under /admin on
 * this origin. Anything else (another host, //host, /login, javascript:...)
 * becomes /admin, so a crafted payload can't send the app elsewhere.
 */
export function safeAdminPath(url: unknown): string {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return "/admin";
  try {
    const base = "https://app.invalid";
    const parsed = new URL(url, base);
    if (parsed.origin !== base) return "/admin";
    if (parsed.pathname !== "/admin" && !parsed.pathname.startsWith("/admin/")) return "/admin";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/admin";
  }
}

/**
 * Called right before sign-out in the app: removes this phone's push token
 * server-side so it stops getting notifications. Safe anywhere (no-op on the web).
 */
export async function unregisterCurrentDevice(unregister: (token: string) => Promise<unknown>): Promise<void> {
  let token: string | null = null;
  try {
    token = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return;
  }
  if (!token) return;
  try {
    await unregister(token);
  } catch (error) {
    console.error("Failed to unregister push device:", error);
  }
  try {
    localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The client app identifies itself in its user agent (synchronously readable, also server-side). */
export function isClientApp(userAgent: string | null | undefined): boolean {
  return typeof userAgent === "string" && userAgent.includes(CLIENT_UA_MARK) && !userAgent.includes(ADMIN_UA_MARK);
}

/** The installed app's id, or null on the web. */
export async function nativeAppId(): Promise<string | null> {
  const app = nativePlugin<{ getInfo: () => Promise<{ id: string }> }>("App");
  if (!app) return null;
  try {
    return (await app.getInfo()).id;
  } catch {
    return null;
  }
}

/**
 * Which push this shell may register: "staff" only in TBJ Admin, "client"
 * only in the client app (its id AND its user-agent mark), otherwise none.
 * Staff and client devices never mix (PushDevice has one owner).
 */
export function pushTargetFor({ appId, userAgent }: { appId: string | null; userAgent: string | null | undefined }): "staff" | "client" | null {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (appId === ADMIN_APP_ID && !ua.includes(CLIENT_UA_MARK)) return "staff";
  if (appId === CLIENT_APP_ID && isClientApp(ua)) return "client";
  return null;
}

/** Where tapping a client push may go: a safe /portal path (safePortalPath), else /portal. */
export function safeClientPushPath(url: unknown): string {
  return safePortalPath(url) ?? "/portal";
}
