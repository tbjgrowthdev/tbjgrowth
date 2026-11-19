// Talking to the Android app shell (mobile/, Capacitor) from the live site.
//
// The apps load https://tbjgrowthtech.com itself, and Capacitor injects
// window.Capacitor (with every installed native plugin under .Plugins) into
// that page. So the site uses the plugins through this global; no Capacitor
// npm package is bundled into the website.
//
// Two apps share the shell (mobile/README.md): TBJ Admin
// (com.tbjgrowthtech.admin, push + biometric lock) and TBJ Growth Tech
// (com.tbjgrowthtech.app, the public site only). Admin-only behaviour must
// check isAdminApp(), never just isNativeApp().

export const ADMIN_APP_ID = "com.tbjgrowthtech.admin";
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
