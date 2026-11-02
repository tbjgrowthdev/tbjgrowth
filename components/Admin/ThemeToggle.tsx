"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const noopSubscribe = () => () => {};

/**
 * Light/dark switch for the admin. Until an admin picks one, the dashboard
 * follows the OS setting (see components/theme-provider.tsx); the choice is
 * stored in localStorage, so it survives reloads and new sessions.
 */
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The real theme is only known in the browser; render a neutral button on the server.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";
  const label = !mounted ? "Toggle theme" : isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-tint transition-colors"
    >
      {!mounted ? <span className="w-[18px] h-[18px]" /> : isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
