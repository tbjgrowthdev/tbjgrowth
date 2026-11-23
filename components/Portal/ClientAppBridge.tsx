"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { registerClientPushDevice } from "@/app/(portal)/actions/push";
import { nativeAppId, nativePlugin, pushTargetFor, safeClientPushPath, PUSH_TOKEN_STORAGE_KEY } from "@/lib/native";
import { CLIENT_LOCK_SETTING_KEY, LOCK_ATTR, UNLOCKED_KEY, backAction } from "@/lib/native-lock";
import type { PortalStrings } from "@/lib/portal/strings";

// Native features of the TBJ Growth Tech client app, wired from the signed-in
// portal pages. Renders nothing on the web and in TBJ Admin.
//  - Push: registers this phone for the signed-in client user
//    (registerClientPushDevice) and opens a tapped notification's /portal
//    page (safeClientPushPath).
//  - Hardware back: browser history, else leave the app. Ignored while locked.
//  - Optional app lock (More → App lock, per phone): on a fresh start and
//    after 5+ minutes away. Off by default. Failing never signs out.
//  - Offline: the shell shows www/offline.html when the site can't load.

const LOCK_AFTER_MS = 5 * 60 * 1000;

type Listener = { remove: () => Promise<void> | void };
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: <T>(event: string, cb: (data: T) => void) => Promise<Listener>;
};
type AppPlugin = { addListener: <T>(event: string, cb: (data: T) => void) => Promise<Listener>; exitApp: () => Promise<void> };
type BiometricPlugin = { checkBiometry: () => Promise<{ isAvailable: boolean; deviceIsSecure?: boolean }>; internalAuthenticate: (o: Record<string, unknown>) => Promise<void> };

function lockSettingOn(): boolean {
  try {
    return localStorage.getItem(CLIENT_LOCK_SETTING_KEY) === "1";
  } catch {
    return false;
  }
}

function setPageLocked(on: boolean) {
  if (on) document.documentElement.setAttribute(LOCK_ATTR, "1");
  else document.documentElement.removeAttribute(LOCK_ATTR);
  try {
    if (on) sessionStorage.removeItem(UNLOCKED_KEY);
    else sessionStorage.setItem(UNLOCKED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

export default function ClientAppBridge({ t }: { t: PortalStrings["lock"] }) {
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const lockedRef = useRef(false);
  const backgroundedAt = useRef<number | null>(null);
  const canLock = useRef(false);

  const showLock = (on: boolean) => {
    lockedRef.current = on;
    setLocked(on);
    setPageLocked(on);
  };

  const unlock = async () => {
    const bio = nativePlugin<BiometricPlugin>("BiometricAuthNative");
    if (!bio) return showLock(false);
    setUnlocking(true);
    try {
      await bio.internalAuthenticate({ reason: t.reason, androidTitle: t.reason, cancelTitle: "Cancel", allowDeviceCredential: true });
      showLock(false);
    } catch {
      // Cancelled or failed: stay locked; the person can try again.
    } finally {
      setUnlocking(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const listeners: Listener[] = [];
    const keep = (l: Listener) => {
      if (cancelled) void l.remove();
      else listeners.push(l);
    };

    (async () => {
      // Client push only from the client app itself, never from TBJ Admin.
      if (pushTargetFor({ appId: await nativeAppId(), userAgent: navigator.userAgent }) !== "client") {
        if (document.documentElement.hasAttribute(LOCK_ATTR)) setPageLocked(false);
        return;
      }
      if (cancelled) return;
      const push = nativePlugin<PushPlugin>("PushNotifications");
      const app = nativePlugin<AppPlugin>("App");
      const bio = nativePlugin<BiometricPlugin>("BiometricAuthNative");

      try {
        const status = lockSettingOn() && bio ? await bio.checkBiometry() : null;
        canLock.current = !!status && (status.isAvailable || status.deviceIsSecure === true);
      } catch {
        canLock.current = false;
      }
      if (cancelled) return;
      if (!canLock.current) showLock(false);
      else if (document.documentElement.hasAttribute(LOCK_ATTR)) {
        showLock(true);
        void unlock();
      }

      if (app) {
        keep(
          await app.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
            const action = backAction(lockedRef.current, canGoBack);
            if (action === "back") window.history.back();
            else if (action === "exit") void app.exitApp();
          })
        );
        keep(
          await app.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
            if (!isActive) {
              backgroundedAt.current = Date.now();
              return;
            }
            const away = backgroundedAt.current === null ? 0 : Date.now() - backgroundedAt.current;
            backgroundedAt.current = null;
            // The setting can change while the app runs; read it each time.
            if (lockSettingOn() && canLock.current && away >= LOCK_AFTER_MS) {
              showLock(true);
              void unlock();
            }
          })
        );
      }

      if (push) {
        keep(
          await push.addListener("registration", async ({ value }: { value: string }) => {
            try {
              localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, value);
            } catch {
              /* storage unavailable */
            }
            await registerClientPushDevice({ token: value, platform: "android" });
          })
        );
        keep(await push.addListener("registrationError", (error: unknown) => console.error("Push registration failed:", error)));
        keep(
          await push.addListener("pushNotificationActionPerformed", ({ notification }: { notification?: { data?: { url?: unknown } } }) => {
            window.location.assign(safeClientPushPath(notification?.data?.url));
          })
        );
        try {
          let { receive } = await push.checkPermissions();
          if (receive === "prompt" || receive === "prompt-with-rationale") receive = (await push.requestPermissions()).receive;
          if (receive === "granted" && !cancelled) await push.register();
        } catch (error) {
          console.error("Push setup failed:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const l of listeners) void l.remove();
    };
    // Registered once per mount; unlock/showLock only use refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) return null;
  // Into <body>: the portal shell (an .admin-shell) is hidden while locked,
  // and visibility:hidden would hide this screen too if it were inside.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-lock-title"
      className="portal-lock fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-[var(--bg)] px-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Lock size={40} className="text-[var(--admin-orange-text)]" aria-hidden="true" />
      <div className="space-y-2">
        <h2 id="client-lock-title" className="text-xl font-bold">{t.title}</h2>
        <p className="text-sm text-muted">{t.body}</p>
      </div>
      <button type="button" onClick={unlock} disabled={unlocking} className="btn-primary min-h-12 w-full max-w-xs rounded-2xl px-4 font-semibold disabled:opacity-60">
        {t.unlock}
      </button>
    </div>,
    document.body
  );
}
