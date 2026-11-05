"use client";

import type { ReactNode } from "react";
import { Loader2, Save } from "lucide-react";

export const inputCls = "w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40";
export const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 bg-brand-orange-deep text-white rounded-lg hover:bg-brand-orange transition-colors disabled:opacity-60 text-sm font-medium";
export const btnGhost = "inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-muted hover:bg-tint transition-colors disabled:opacity-60 text-sm";

export function Card({ title, hint, children, action }: { title?: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="bg-card p-5 sm:p-6 rounded-xl shadow-sm border border-border">
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="text-lg font-bold text-foreground">{title}</h2>}
            {hint && <p className="text-sm text-caption mt-0.5">{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-medium text-muted mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-caption mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-foreground">
      <input type="checkbox" className="h-4 w-4 accent-[#c4491a]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function SaveButton({ saving, label = "Save changes", onClick }: { saving: boolean; label?: string; onClick?: () => void }) {
  return (
    <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={saving} className={btnPrimary}>
      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
      {saving ? "Saving…" : label}
    </button>
  );
}

/** "" -> null, otherwise a number (NaN -> null). */
export function toNum(v: string): number | null {
  const t = v.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function numStr(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : String(n);
}
