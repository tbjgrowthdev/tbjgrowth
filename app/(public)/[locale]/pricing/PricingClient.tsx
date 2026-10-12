"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles, ArrowRight } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  tagline: string | null;
  priceGbp: number;
  billingTerm: string;
  features: string[];
  isPopular: boolean;
};

const CURRENCIES = [
  { code: "GBP", symbol: "£" },
  { code: "USD", symbol: "$" },
  { code: "BDT", symbol: "৳" },
] as const;

type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export default function PricingClient({
  plans,
  usdPerGbp,
  bdtPerGbp,
}: {
  plans: Plan[];
  usdPerGbp: number;
  bdtPerGbp: number;
}) {
  const [currency, setCurrency] = useState<CurrencyCode>("GBP");

  const convert = (priceGbp: number) => {
    if (currency === "USD") return priceGbp * usdPerGbp;
    if (currency === "BDT") return priceGbp * bdtPerGbp;
    return priceGbp;
  };

  const symbol = CURRENCIES.find((c) => c.code === currency)!.symbol;
  const billingLabel = (term: string) => (term === "one-time" ? "one-time" : `/${term}`);

  return (
    <main className="min-h-screen bg-background pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cream to-ivory dark:from-brand-orange/10 dark:to-brand-orange-light/10 border border-brand-orange/20 dark:border-brand-orange/20 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
            <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">Simple, Transparent Pricing</span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Plans That{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">Scale With You</span>
          </h1>
          <p className="text-lg text-muted">
            Choose the growth plan that fits your business. No hidden fees, cancel anytime.
          </p>
        </div>

        {/* Currency Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 bg-card border border-border rounded-full">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  currency === c.code
                    ? "bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>

        {plans.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-16 px-8 rounded-3xl bg-card border border-dashed border-border">
            <p className="text-muted">Pricing plans are coming soon. Get in touch for a custom quote.</p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold rounded-xl"
            >
              Contact Us <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 ${
                  plan.isPopular
                    ? "bg-off-black border-brand-orange shadow-2xl shadow-brand-orange/20 scale-105"
                    : "bg-card border-border hover:border-accent-border shadow-lg"
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white text-xs font-bold rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className={`text-xl font-bold mb-1 ${plan.isPopular ? "text-white" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                {plan.tagline && (
                  <p className={`text-sm mb-6 ${plan.isPopular ? "text-white/60" : "text-muted"}`}>
                    {plan.tagline}
                  </p>
                )}
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.isPopular ? "text-white" : "text-foreground"}`}>
                    {symbol}
                    {convert(plan.priceGbp).toLocaleString(undefined, { maximumFractionDigits: currency === "BDT" ? 0 : 2 })}
                  </span>
                  <span className={`text-sm ml-1 ${plan.isPopular ? "text-white/60" : "text-muted"}`}>
                    {billingLabel(plan.billingTerm)}
                  </span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check size={16} className={`flex-shrink-0 mt-0.5 ${plan.isPopular ? "text-brand-orange-light" : "text-brand-orange-deep dark:text-brand-orange-light"}`} />
                      <span className={plan.isPopular ? "text-white/75" : "text-muted"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`text-center px-6 py-3 rounded-xl font-semibold transition-all ${
                    plan.isPopular
                      ? "bg-white text-off-black hover:bg-white/90"
                      : "bg-foreground text-background hover:opacity-90"
                  }`}
                >
                  Get Started
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-caption mt-10">
          Prices shown in GBP are our base currency; USD/BDT amounts are approximate conversions.
        </p>
      </div>
    </main>
  );
}
