"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Lock } from "lucide-react";
import { registerPushDevice } from "@/app/(admin)/actions/push";
import { isAdminApp, nativePlugin, safeAdminPath, PUSH_TOKEN_STORAGE_KEY } from "@/lib/native";
import { LOCK_ATTR, UNLOCKED_KEY, backAction } from "@/lib/native-lock";

// Native features of the TBJ Admin Android app, wired from the live admin
// pages (see lib/native.ts for why this runs on the site, not in the APK).
// Renders nothing on the web and in the client app (com.tbjgrowthtech.app).
//
//  - Biometric lock: on a fresh app start, and after 5+ minutes in the
//    background, admin pages are hidden until fingerprint/face/device PIN
//    succeeds. It holds across reloads (notification taps, Back) and covers
//    the page before first paint; see lib/native-lock.ts. Failing never logs
//    out or revokes anything; "Sign in with password" signs out instead.
//  - Push: asks permission, registers the FCM token for this user/session,
//    and opens the notification's /admin page when it is tapped.
//  - Hardware back button: browser history, else leave the app. Ignored while locked.

const LOCK_AFTER_MS = 5 * 60 * 1000;

function setUnlockedFlag(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCKED_KEY, "1");
    else sessionStorage.removeItem(UNLOCKED_KEY);
  } catch {
    /* storage unavailable: the in-page lock still holds until unlock */
  }
}

/** Hides or shows the admin shell (app/admin.css) and records the state for reloads. */
function setPageLocked(on: boolean) {
  if (on) document.documentElement.setAttribute(LOCK_ATTR, "1");
  else document.documentElement.removeAttribute(LOCK_ATTR);
  setUnlockedFlag(!on);
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
      await bio.internalAuthenticate({
        reason: "Unlock TBJ Admin",
        androidTitle: "Unlock TBJ Admin",
        androidSubtitle: "Confirm it's you",
        cancelTitle: "Cancel",
        allowDeviceCredential: true,
      });
      showLock(false);
    } catch {
      // Cancelled or failed: stay locked. The person can retry or sign in with a password.
    } finally {
      setUnlocking(false);
    }
  };

  // Hide the page and prompt straight away.
  const lock = () => {
    showLock(true);
    void unlock();
  };

  const signInWithPassword = () => {
    // Signing in again with password + 2FA proves more than the biometric
    // check, so don't ask for both. The page stays hidden until sign-out navigates.
    setUnlockedFlag(true);
    void signOut({ callbackUrl: "/login" });
  };

  useEffect(() => {
    let cancelled = false;
    const listeners: Listener[] = [];
    const keep = (l: Listener) => {
      if (cancelled) void l.remove();
      else listeners.push(l);
    };

    (async () => {
      if (!(await isAdminApp())) {
        // Never leave a page hidden if the shell turned out not to be TBJ Admin.
        if (document.documentElement.hasAttribute(LOCK_ATTR)) setPageLocked(false);
        return;
      }
      if (cancelled) return;
      const push = nativePlugin<PushPlugin>("PushNotifications");
      const app = nativePlugin<AppPlugin>("App");
      const bio = nativePlugin<BiometricPlugin>("BiometricAuthNative");

      // Lock first, before anything that waits on the person (permission dialogs).
      try {
        const status = bio ? await bio.checkBiometry() : null;
        canLock.current = !!status && (status.isAvailable || status.deviceIsSecure === true);
      } catch {
        canLock.current = false;
      }
      if (cancelled) return;
      if (!canLock.current) showLock(false);
      else if (document.documentElement.hasAttribute(LOCK_ATTR)) lock();

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
            if (canLock.current && away >= LOCK_AFTER_MS) lock();
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
            await registerPushDevice({ token: value, platform: "android" });
          })
        );
        keep(await push.addListener("registrationError", (error: unknown) => console.error("Push registration failed:", error)));
        keep(
          // Navigating reloads the page. If the app is locked it stays locked
          // (lock() cleared the unlocked flag), so a notification tap can't skip it.
          await push.addListener("pushNotificationActionPerformed", ({ notification }: { notification?: { data?: { url?: unknown } } }) => {
            window.location.assign(safeAdminPath(notification?.data?.url));
          })
        );
        try {
          let { receive } = await push.checkPermissions();
          if (receive === "prompt" || receive === "prompt-with-rationale") receive = (await push.requestPermissions()).receive;
          // Registering on every app start also refreshes the device's lastSeenAt.
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
    // Native listeners are registered once per mount on purpose; lock() and
    // unlock() only use refs and state setters, so the first render's copies stay correct.
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
        <button type="button" onClick={signInWithPassword} className="min-h-12 rounded-lg border border-border px-4 text-sm">
          Sign in with password
        </button>
      </div>
    </div>
  );
}
