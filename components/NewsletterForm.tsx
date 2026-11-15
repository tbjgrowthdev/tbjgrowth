"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles } from "lucide-react";
import { subscribeToNewsletter } from "@/app/(admin)/actions/newsletter";
import type { NewsletterSource } from "@/lib/newsletter";

type Copy = {
  emailLabel?: string;
  placeholder?: string;
  subscribe?: string;
  success?: string;
  error?: string;
  rateLimited?: string;
};

type Status = "idle" | "sending" | "success" | "error" | "rate_limited";

/**
 * Newsletter signup shared by the footer ("compact") and the blog band
 * ("band"). Saves the address through subscribeToNewsletter, tagged with
 * `source` so /admin/subscribers shows which form each signup came from.
 */
export default function NewsletterForm({
  source,
  variant = "compact",
  copy = {},
}: {
  source: NewsletterSource;
  variant?: "compact" | "band";
  copy?: Copy;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = copy.emailLabel ?? "Email address";
  const placeholder = copy.placeholder ?? "Enter your email";
  const idPrefix = `newsletter-${variant === "band" ? "band" : "footer"}`;

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "sending") return;
    setStatus("sending");
    let next: Status = "error";
    try {
      const result = await subscribeToNewsletter({
        email,
        source,
        path: window.location.pathname,
        locale: document.documentElement.lang || null,
        website,
      });
      if (result.success) next = "success";
      else if (result.error === "rate_limited") next = "rate_limited";
    } catch {
      // Network error or the action threw: show the generic error.
    }
    setStatus(next);
    if (next === "success") {
      setEmail("");
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const isBand = variant === "band";
  const sending = status === "sending";

  let message: React.ReactNode = null;
  if (status === "success" || status === "error" || status === "rate_limited") {
    const ok = status === "success";
    const text = ok
      ? (copy.success ?? "Thanks for subscribing! 🎉")
      : status === "rate_limited"
        ? (copy.rateLimited ?? "Too many attempts. Please wait a minute and try again.")
        : (copy.error ?? "Something went wrong. Please try again.");
    const tone = ok
      ? isBand
        ? "text-green-400 dark:text-white"
        : "text-green-600 dark:text-green-400"
      : isBand
        ? "text-red-300 dark:text-white"
        : "text-red-600 dark:text-red-400";
    message = (
      <motion.p
        key={status}
        role={ok ? "status" : "alert"}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${isBand ? "text-sm mt-3" : "text-xs mt-2"} font-medium ${tone}`}
      >
        {text}
      </motion.p>
    );
  }

  // Clipped to 1px rather than display:none, which some bots skip. Hidden
  // from screen readers and keyboard focus, so people never fill it in.
  const honeypot = (
    <div aria-hidden="true" className="sr-only">
      <label htmlFor={`${idPrefix}-website`}>Website</label>
      <input
        id={`${idPrefix}-website`}
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
      />
    </div>
  );

  if (isBand) {
    return (
      <div>
        <form onSubmit={handleSubscribe} className="relative flex flex-col sm:flex-row gap-3">
          {honeypot}
          <label htmlFor={`${idPrefix}-email`} className="sr-only">
            {label}
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            autoComplete="email"
            maxLength={320}
            required
            className="min-w-0 flex-1 h-12 px-5 rounded-full bg-white/10 border border-white/15 text-white placeholder-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange transition-all dark:bg-black/[.22] dark:border-white/45 dark:placeholder-white/80 dark:focus-visible:outline-white"
          />
          <button
            type="submit"
            disabled={sending}
            aria-busy={sending}
            className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 transition-shadow disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange dark:bg-none dark:bg-white dark:text-brand-orange-deep dark:shadow-none dark:hover:bg-brand-100 dark:focus-visible:outline-white"
          >
            {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {copy.subscribe ?? "Subscribe"}
          </button>
        </form>
        {message}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubscribe} className="relative">
        {honeypot}
        <label htmlFor={`${idPrefix}-email`} className="sr-only">
          {label}
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          autoComplete="email"
          maxLength={320}
          required
          className="w-full px-4 py-3 pr-12 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent text-foreground placeholder-muted transition-all"
        />
        <motion.button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          aria-label={copy.subscribe ?? "Subscribe"}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white rounded-lg hover:shadow-lg hover:shadow-brand-orange/25 transition-shadow disabled:opacity-70"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === "success" ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <Sparkles className="w-4 h-4" />
            </motion.div>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </form>
      {message}
    </>
  );
}
