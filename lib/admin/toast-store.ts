// State behind the admin toasts. Plain module state (no React), so
// `toast.success/error/info(...)` can be called from anywhere on the client
// — event handlers, helpers, after an await — and <Toaster />
// (components/Admin/Toast.tsx) subscribes to it.

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; title: string; description?: string; duration: number };
type ToastOptions = { description?: string; duration?: number };

const DEFAULT_DURATION: Record<ToastKind, number> = { success: 4000, info: 5000, error: 7000 };
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return items;
}

function show(kind: ToastKind, title: string, opts: ToastOptions = {}) {
  // The same message fired twice in a row (double click, several uploads behind one action) shows once.
  const dup = items.find((t) => t.kind === kind && t.title === title && t.description === opts.description);
  if (dup) return dup.id;
  const item: ToastItem = { id: nextId++, kind, title, description: opts.description, duration: opts.duration ?? DEFAULT_DURATION[kind] };
  items = [...items, item].slice(-MAX_VISIBLE);
  emit();
  return item.id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => show("success", title, opts),
  error: (title: string, opts?: ToastOptions) => show("error", title, opts),
  info: (title: string, opts?: ToastOptions) => show("info", title, opts),
  dismiss: dismissToast,
};
