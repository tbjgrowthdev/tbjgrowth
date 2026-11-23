// Biometric lock for the TBJ Admin Android app (components/Admin/NativeAppBridge.tsx).
//
// The lock must hold across full page loads (tapping a notification or
// pressing Back reloads the page) and must cover admin pages BEFORE they
// paint on a cold start. So:
//  - The admin app appends ADMIN_UA_MARK to its user agent
//    (mobile/scripts/flavor-configs.mjs), which is readable synchronously.
//  - LOCK_INIT_SCRIPT runs before paint (app/(admin)/layout.tsx) and sets
//    html[data-tbj-lock] unless this app run was already unlocked; app/admin.css
//    hides the admin shell while that attribute is set.
//  - lock() clears UNLOCKED_KEY, so a reload while locked stays locked.
// sessionStorage dies with the app process, so a cold start always locks.

export const ADMIN_UA_MARK = "TBJAdminApp";
export const UNLOCKED_KEY = "tbj-unlocked";
export const LOCK_ATTR = "data-tbj-lock";

/** True when the page should start hidden behind the lock. */
export function shouldLockOnLoad(userAgent: string, unlockedFlag: string | null): boolean {
  return userAgent.includes(ADMIN_UA_MARK) && unlockedFlag !== "1";
}

/** What the hardware Back button does. While locked it does nothing, so it can't skip the lock. */
export function backAction(locked: boolean, canGoBack: boolean): "ignore" | "back" | "exit" {
  if (locked) return "ignore";
  return canGoBack ? "back" : "exit";
}

// Inline, pre-paint version of shouldLockOnLoad. If storage can't be read in
// the admin app it stays locked (fails closed).
export const LOCK_INIT_SCRIPT = `(function(){var ua=navigator.userAgent||"";if(ua.indexOf(${JSON.stringify(ADMIN_UA_MARK)})===-1)return;var f=null;try{f=sessionStorage.getItem(${JSON.stringify(UNLOCKED_KEY)})}catch(e){}if(f!=="1")document.documentElement.setAttribute(${JSON.stringify(LOCK_ATTR)},"1")})()`;

// ── TBJ Growth Tech client app (components/Portal/ClientAppBridge.tsx) ──
// The client app appends CLIENT_UA_MARK to its user agent
// (mobile/scripts/flavor-configs.mjs). Its app lock is optional: off until
// the client turns it on in More (CLIENT_LOCK_SETTING_KEY in localStorage,
// per phone). When on, it locks on a fresh start and after 5+ minutes away,
// like TBJ Admin, and CLIENT_LOCK_INIT_SCRIPT hides /portal before paint.
export const CLIENT_UA_MARK = "TBJClientApp";
export const CLIENT_LOCK_SETTING_KEY = "tbj-client-lock";

export function shouldClientLockOnLoad(userAgent: string, lockSetting: string | null, unlockedFlag: string | null): boolean {
  return userAgent.includes(CLIENT_UA_MARK) && !userAgent.includes(ADMIN_UA_MARK) && lockSetting === "1" && unlockedFlag !== "1";
}

/** For /portal/login: never start hidden there (no bridge runs on that page to unlock it). */
export const CLIENT_LOCK_CLEAR_SCRIPT = `document.documentElement.removeAttribute(${JSON.stringify(LOCK_ATTR)})`;

export const CLIENT_LOCK_INIT_SCRIPT = `(function(){var ua=navigator.userAgent||"";if(ua.indexOf(${JSON.stringify(CLIENT_UA_MARK)})===-1||ua.indexOf(${JSON.stringify(ADMIN_UA_MARK)})!==-1)return;var on=null,f=null;try{on=localStorage.getItem(${JSON.stringify(CLIENT_LOCK_SETTING_KEY)})}catch(e){}if(on!=="1")return;try{f=sessionStorage.getItem(${JSON.stringify(UNLOCKED_KEY)})}catch(e){}if(f!=="1")document.documentElement.setAttribute(${JSON.stringify(LOCK_ATTR)},"1")})()`;
