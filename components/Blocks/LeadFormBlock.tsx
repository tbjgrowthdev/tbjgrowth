"use client";

import { useState } from "react";
import { submitContactForm } from "@/app/(admin)/actions/forms";

type Props = {
  heading: string;
  text: string;
  submitLabel: string;
  successMessage: string;
  showPhone: boolean;
  showCompany: boolean;
  showMessage: boolean;
  /** Recorded on the lead so the team knows which page produced it, e.g. "Landing page: /seo-audit". */
  source: string;
  headingId: string;
};

const inputClass =
  "w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-caption focus:outline-none focus:ring-2 focus:ring-brand-orange";

// Saves through the same public action as the Contact page (submitContactForm): same zod validation, the same
// per-email throttle, the same Leads inbox and notification email. A block form is therefore not a new write path.
export default function LeadFormBlock({ heading, text, submitLabel, successMessage, showPhone, showCompany, showMessage, source, headingId }: Props) {
  const [state, setState] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const result = await submitContactForm({
        name: state.name,
        email: state.email,
        phone: showPhone ? state.phone || null : null,
        company: showCompany ? state.company || null : null,
        // The lead record requires a message; when the form has no message box, say where the lead came from.
        message: showMessage ? state.message : `Lead form submission from ${source}`,
        source: source.slice(0, 100), // submitContactForm caps the source at 100 characters
      });
      if (result.success) setStatus("done");
      else {
        setError(result.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h2 id={headingId} className="text-2xl md:text-3xl font-bold text-foreground text-center">{heading}</h2>
      {text && <p className="mt-3 text-muted text-center">{text}</p>}
      {status === "done" ? (
        <p role="status" className="mt-8 rounded-xl border border-border bg-card p-6 text-center text-foreground">{successMessage}</p>
      ) : (
        <form onSubmit={onSubmit} aria-labelledby={headingId} className="mt-8 space-y-4">
          <input className={inputClass} type="text" name="name" required maxLength={200} placeholder="Your name" aria-label="Your name" autoComplete="name" value={state.name} onChange={set("name")} />
          <input className={inputClass} type="email" name="email" required maxLength={320} placeholder="Email address" aria-label="Email address" autoComplete="email" value={state.email} onChange={set("email")} />
          {showPhone && <input className={inputClass} type="tel" name="phone" maxLength={50} placeholder="Phone number" aria-label="Phone number" autoComplete="tel" value={state.phone} onChange={set("phone")} />}
          {showCompany && <input className={inputClass} type="text" name="company" maxLength={200} placeholder="Company" aria-label="Company" autoComplete="organization" value={state.company} onChange={set("company")} />}
          {showMessage && <textarea className={inputClass} name="message" required maxLength={5000} rows={4} placeholder="How can we help?" aria-label="Message" value={state.message} onChange={set("message")} />}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" disabled={status === "submitting"} className="w-full px-6 py-3 rounded-lg bg-brand-orange-deep text-white font-semibold hover:bg-brand-orange disabled:opacity-60 transition-colors">
            {status === "submitting" ? "Sending…" : submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}
