"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";

type Copy = { emailLabel?: string; placeholder?: string; subscribe?: string; success?: string };

/**
 * Newsletter signup shared by the footer ("compact") and the blog band
 * ("band"). Behaviour is the footer's original: the address is required, and
 * a thank-you shows for 3s. There is no subscribe endpoint on the site yet, so
 * nothing is sent anywhere. When one exists, wire it up here, in one place.
 */
export default function NewsletterForm({
  variant = "compact",
  copy = {},
}: {
  variant?: "compact" | "band";
  copy?: Copy;
}) {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const label = copy.emailLabel ?? "Email address";
  const placeholder = copy.placeholder ?? "Enter your email";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail("");
      setTimeout(() => setIsSubscribed(false), 3000);
    }
  };

  const success = (
    <motion.p
      role="status"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        variant === "band"
          ? "text-sm text-green-400 dark:text-white mt-3 font-medium"
          : "text-xs text-green-600 dark:text-green-400 mt-2 font-medium"
      }
    >
      {copy.success ?? "Thanks for subscribing! 🎉"}
    </motion.p>
  );

  if (variant === "band") {
    return (
      <div>
        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="newsletter-band-email" className="sr-only">
            {label}
          </label>
          <input
            id="newsletter-band-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={placeholder}
            autoComplete="email"
            required
            className="min-w-0 flex-1 h-12 px-5 rounded-full bg-white/10 border border-white/15 text-white placeholder-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange transition-all dark:bg-black/[.22] dark:border-white/45 dark:placeholder-white/80 dark:focus-visible:outline-white"
          />
          <button
            type="submit"
            className="h-12 px-7 rounded-full bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold shadow-lg shadow-brand-orange/25 hover:shadow-brand-orange/40 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange dark:bg-none dark:bg-white dark:text-brand-orange-deep dark:shadow-none dark:hover:bg-brand-100 dark:focus-visible:outline-white"
          >
            {copy.subscribe ?? "Subscribe"}
          </button>
        </form>
        {isSubscribed && success}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubscribe} className="relative">
        <label htmlFor="newsletter-footer-email" className="sr-only">
          {label}
        </label>
        <input
          id="newsletter-footer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          autoComplete="email"
          required
          className="w-full px-4 py-3 pr-12 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent text-foreground placeholder-muted transition-all"
        />
        <motion.button
          type="submit"
          aria-label={copy.subscribe ?? "Subscribe"}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white rounded-lg hover:shadow-lg hover:shadow-brand-orange/25 transition-shadow"
        >
          {isSubscribed ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
              <Sparkles className="w-4 h-4" />
            </motion.div>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </form>
      {isSubscribed && success}
    </>
  );
}
