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
const STAFF_PREFIXES = ["/admin", "/login"];
export const ADMIN_THEME_STORAGE_KEY = "tbj-admin-theme";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname() || "/";
  const isStaff = STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    // next-themes reads its stored value once, when it mounts. The key
    // remounts it when navigation crosses between the two areas, so each
    // reads its own key. next-themes also renders its no-flash script with
    // these props on the server, so the right theme is applied before paint.
    <NextThemesProvider
      key={isStaff ? "staff" : "site"}
      {...props}
      storageKey={isStaff ? ADMIN_THEME_STORAGE_KEY : props.storageKey}
      defaultTheme={isStaff ? "system" : props.defaultTheme}
      enableSystem
    >
      {children}
    </NextThemesProvider>
  );
}
