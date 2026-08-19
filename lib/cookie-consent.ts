"use client";

export const COOKIE_CONSENT_KEY = "tbj_cookie_consent";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeConsent(consent: Omit<CookieConsent, "necessary" | "decidedAt">) {
  const full: CookieConsent = { necessary: true, decidedAt: new Date().toISOString(), ...consent };
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(full));
  window.dispatchEvent(new CustomEvent("tbj-cookie-consent-changed", { detail: full }));
  return full;
}

/** For future client-side tracking scripts (e.g. a GA4 gtag) to check before loading. */
export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true;
}
