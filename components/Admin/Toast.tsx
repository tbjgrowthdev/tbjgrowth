"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { dismissToast, getToasts, subscribeToasts, type ToastItem, type ToastKind } from "@/lib/admin/toast-store";

export { toast, dismissToast } from "@/lib/admin/toast-store";

// Admin toast notifications. `toast.success/error/info(...)` can be called
// from anywhere on the client (event handlers, helpers, after an await) —
// no hook or context needed — and <Toaster /> (mounted once in
// app/(admin)/layout.tsx) renders them. The layout persists across admin
// navigations, so a toast fired right before router.push() stays visible
// on the next page.
//
// Toasts are an addition to each screen's own inline feedback, not a
// replacement: most calls come from withToast() (lib/admin/toast.ts) around
// a server action. The state lives in lib/admin/toast-store.ts.

const EMPTY: ToastItem[] = [];

const STYLE: Record<ToastKind, { icon: typeof Info; accent: string; iconClass: string }> = {
  success: { icon: CheckCircle2, accent: "bg-green-500", iconClass: "text-green-600 dark:text-green-400" },
  error: { icon: AlertCircle, accent: "bg-red-500", iconClass: "text-red-600 dark:text-red-400" },
  info: { icon: Info, accent: "bg-brand-orange", iconClass: "text-brand-orange-deep dark:text-brand-orange-light" },
};

function ToastCard({ item }: { item: ToastItem }) {
  const { icon: Icon, accent, iconClass } = STYLE[item.kind];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  // Auto-dismiss, paused while hovered or focused so a long error can be read.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role={item.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative w-full sm:w-96 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
      <div className="flex items-start gap-3 py-3 pl-4 pr-2">
        <Icon size={20} className={`mt-0.5 flex-shrink-0 ${iconClass}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          {item.description && <p className="mt-0.5 text-sm text-muted break-words">{item.description}</p>}
        </div>
        <button
          type="button"
          onClick={() => dismissToast(item.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-md p-1 text-caption hover:bg-tint hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>
      {/* Time-left bar; pauses together with the dismiss timer. */}
      <span
        className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full origin-left ${accent} opacity-40`}
        style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused ? "paused" : "running" }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

export function Toaster() {
  const list = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed z-[60] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 flex flex-col items-stretch sm:items-end gap-2"
    >
      <AnimatePresence initial={false}>
        {list.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
