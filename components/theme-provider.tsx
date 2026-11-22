"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

// The admin dashboard and login screen keep their own theme choice, separate
// from the public site's: an admin switching the dashboard to light mode
// shouldn't change how the marketing site looks in their browser, and the
// dashboard follows the OS setting until someone picks a theme, while the
// public site keeps its dark brand default.
//
// The Client Hub (/portal) is a third area with its own key: clients get the
// same follow-the-OS default as staff, without sharing the staff choice.
const STAFF_PREFIXES = ["/admin", "/login"];
const PORTAL_PREFIX = "/portal";
export const ADMIN_THEME_STORAGE_KEY = "tbj-admin-theme";
export const PORTAL_THEME_STORAGE_KEY = "tbj-portal-theme";

const under = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname() || "/";
  const area = under(pathname, PORTAL_PREFIX) ? "portal" : STAFF_PREFIXES.some((p) => under(pathname, p)) ? "staff" : "site";
  const isAppArea = area !== "site";

  return (
    // next-themes reads its stored value once, when it mounts. The key
    // remounts it when navigation crosses between the two areas, so each
    // reads its own key. next-themes also renders its no-flash script with
    // these props on the server, so the right theme is applied before paint.
    <NextThemesProvider
      key={area}
      {...props}
      storageKey={area === "portal" ? PORTAL_THEME_STORAGE_KEY : area === "staff" ? ADMIN_THEME_STORAGE_KEY : props.storageKey}
      defaultTheme={isAppArea ? "system" : props.defaultTheme}
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}
