"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { FaYoutube, FaBehance, FaDribbble } from "react-icons/fa";

type SiteSettings = {
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  behanceUrl?: string | null;
  dribbbleUrl?: string | null;
} | null;

const stats = [
  { value: "50+", label: "Projects delivered" },
  { value: "95%", label: "Client retention" },
  { value: "3+", label: "Years running campaigns" },
  { value: "6", label: "Industries served" },
];

// What a lead sees after filling in a form on a TBJ-built site.
const timeline = [
  { time: "09:41:02", event: "New enquiry from your website", tag: "Lead" },
  { time: "09:41:09", event: "WhatsApp reply sent automatically", tag: "AI" },
  { time: "09:41:11", event: "Contact created in CRM, owner assigned", tag: "CRM" },
  { time: "09:44:30", event: "Call booked for tomorrow, 11:00", tag: "Booked" },
];

export default function Hero({ settings }: { settings?: SiteSettings } = {}) {
  const socialLinks = [
    { icon: Linkedin, href: settings?.linkedinUrl, label: "LinkedIn" },
    { icon: Twitter, href: settings?.twitterUrl, label: "Twitter" },
    { icon: Instagram, href: settings?.instagramUrl, label: "Instagram" },
    { icon: Facebook, href: settings?.facebookUrl, label: "Facebook" },
    { icon: FaYoutube, href: settings?.youtubeUrl, label: "YouTube" },
    { icon: FaBehance, href: settings?.behanceUrl, label: "Behance" },
    { icon: FaDribbble, href: settings?.dribbbleUrl, label: "Dribbble" },
  ].filter((s): s is typeof s & { href: string } => Boolean(s.href));

  return (
    <section className="relative bg-background pt-32 lg:pt-44">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="eyebrow mb-8 flex items-center gap-3"
        >
          <span className="h-px w-8 bg-brand-500" />
          Growth partner for UK &amp; US businesses
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.035em] text-foreground sm:text-6xl lg:text-[5.5rem]"
        >
          We build the site, run the ads and <span className="serif-accent">automate</span> the follow-up.
        </motion.h1>

        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="lg:col-span-5"
          >
            <p className="text-lg leading-relaxed text-muted">
              TBJ Growth Tech is a Bangladesh-based team that designs your website, runs the campaigns that fill your
              pipeline, and builds the AI automation that answers every lead, so nothing gets missed.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link
                href="/book-a-call"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-colors hover:bg-brand-500"
              >
                Book a free strategy call
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/services"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline decoration-border decoration-2 underline-offset-[6px] transition-colors hover:decoration-brand-500"
              >
                See our services
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            {socialLinks.length > 0 && (
              <div className="mt-10 flex items-center gap-4 text-caption">
                {socialLinks.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="transition-colors hover:text-brand-500"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </a>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Lead-response timeline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="lg:col-span-7"
          >
            <div className="overflow-hidden rounded-2xl bg-charcoal text-[#F2ECE8] ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <span className="text-sm font-medium">What happens when a lead comes in</span>
                <span className="font-mono text-xs text-white/50">3 min 28 s</span>
              </div>
              <ol className="divide-y divide-white/10">
                {timeline.map((t, i) => (
                  <motion.li
                    key={t.time}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.15, duration: 0.5 }}
                    className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 px-6 py-4 text-sm"
                  >
                    <span className="font-mono text-xs text-white/45">{t.time}</span>
                    <span>{t.event}</span>
                    <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] font-medium text-brand-300">
                      {t.tag}
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          </motion.div>
        </div>

        {/* Proof row */}
        <dl className="mt-20 grid grid-cols-2 border-t border-border lg:mt-28 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col-reverse justify-end py-8 lg:py-10 ${i > 0 ? "lg:border-l lg:border-border lg:pl-8" : ""} ${
                i % 2 === 1 ? "border-l border-border pl-6 lg:pl-8" : ""
              }`}
            >
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="mt-1 text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
