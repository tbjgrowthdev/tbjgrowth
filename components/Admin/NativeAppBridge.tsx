"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Lock } from "lucide-react";
import { registerPushDevice } from "@/app/(admin)/actions/push";
import { isAdminApp, nativePlugin, safeAdminPath, PUSH_TOKEN_STORAGE_KEY } from "@/lib/native";

// Native features of the TBJ Admin Android app, wired from the live admin
// pages (see lib/native.ts for why this runs on the site, not in the APK).
// Renders nothing on the web and in the client app (com.tbjgrowthtech.app).
//
//  - Push: asks permission, registers the FCM token for this user/session,
//    and opens the notification's /admin page when it is tapped.
//  - Hardware back button: browser history, else leave the app.
//  - Biometric lock: on a fresh app start, and after 5+ minutes in the background, the screen is
//    covered until fingerprint/face/device PIN succeeds. Failing never logs
//    out or revokes anything; "Sign in with password" signs out instead.

const LOCK_AFTER_MS = 5 * 60 * 1000;
// sessionStorage dies with the app process, so a cold start always asks again.
const UNLOCKED_KEY = "tbj-unlocked";

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function wasUnlockedThisRun(): boolean {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

type Listener = { remove: () => Promise<void> | void };
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: <T>(event: string, cb: (data: T) => void) => Promise<Listener>;
};
type AppPlugin = {
  addListener: <T>(event: string, cb: (data: T) => void) => Promise<Listener>;
  exitApp: () => Promise<void>;
};
type BiometricPlugin = {
  checkBiometry: () => Promise<{ isAvailable: boolean; deviceIsSecure?: boolean }>;
  internalAuthenticate: (options: Record<string, unknown>) => Promise<void>;
};

export default function NativeAppBridge() {
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const canLock = useRef(false);

  const unlock = async () => {
    const bio = nativePlugin<BiometricPlugin>("BiometricAuthNative");
    if (!bio) {
      markUnlocked();
      return setLocked(false);
    }
    setUnlocking(true);
    try {
      await bio.internalAuthenticate({
        reason: "Unlock TBJ Admin",
        androidTitle: "Unlock TBJ Admin",
        androidSubtitle: "Confirm it's you",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
      });
      markUnlocked();
      setLocked(false);
    } catch {
      // Cancelled or failed: stay locked. The person can retry or sign in with a password.
    } finally {
      setUnlocking(false);
    }
  };

  // Cover the screen and prompt straight away.
  const lock = () => {
    setLocked(true);
    void unlock();
  };

  useEffect(() => {
    let cancelled = false;
    const listeners: Listener[] = [];

    (async () => {
      if (!(await isAdminApp()) || cancelled) return;
      const push = nativePlugin<PushPlugin>("PushNotifications");
      const app = nativePlugin<AppPlugin>("App");
      const bio = nativePlugin<BiometricPlugin>("BiometricAuthNative");

      if (push) {
        listeners.push(
          await push.addListener("registration", async ({ value }: { value: string }) => {
            try {
              localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, value);
            } catch {
              /* storage unavailable */
            }
            await registerPushDevice({ token: value, platform: "android" });
          }),
          await push.addListener("registrationError", (error: unknown) => console.error("Push registration failed:", error)),
          await push.addListener("pushNotificationActionPerformed", ({ notification }: { notification?: { data?: { url?: unknown } } }) => {
            window.location.assign(safeAdminPath(notification?.data?.url));
          })
        );
        try {
          let { receive } = await push.checkPermissions();
          if (receive === "prompt" || receive === "prompt-with-rationale") receive = (await push.requestPermissions()).receive;
          // Registering on every app start also refreshes the device's lastSeenAt.
          if (receive === "granted") await push.register();
        } catch (error) {
          console.error("Push setup failed:", error);
        }
      }

      if (bio) {
        try {
          const status = await bio.checkBiometry();
          canLock.current = status.isAvailable || status.deviceIsSecure === true;
        } catch {
          canLock.current = false;
        }
        if (!cancelled && canLock.current && !wasUnlockedThisRun()) lock();
      }

      if (app) {
        listeners.push(
          await app.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
            if (canGoBack) window.history.back();
            else void app.exitApp();
          }),
          await app.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
            if (!isActive) {
              backgroundedAt.current = Date.now();
              return;
            }
            const away = backgroundedAt.current === null ? 0 : Date.now() - backgroundedAt.current;
            backgroundedAt.current = null;
            if (canLock.current && away >= LOCK_AFTER_MS) lock();
          })
        );
      }
    })();

    return () => {
      cancelled = true;
      for (const l of listeners) void l.remove();
    };
    // Native listeners are registered once per mount on purpose; lock() only
    // uses state setters, so the first render's copy stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="native-lock-title"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <Lock size={40} className="text-brand-orange-deep" />
      <div className="space-y-2">
        <h2 id="native-lock-title" className="text-xl font-bold text-foreground">TBJ Admin is locked</h2>
        <p className="text-sm text-caption">Unlock with your fingerprint, face or phone PIN.</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={unlock}
          disabled={unlocking}
          className="min-h-12 rounded-lg bg-brand-orange-deep px-4 font-semibold text-white disabled:opacity-50"
        >
          Unlock
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="min-h-12 rounded-lg border border-border px-4 text-sm"
        >
          Sign in with password
        </button>
      </div>
    </div>
  );
}
