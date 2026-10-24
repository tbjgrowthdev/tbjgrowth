"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
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
    <section className="bg-background pt-28 lg:pt-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[4.25rem]"
            >
              A small team that builds your site, runs your ads and answers your leads.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mt-6 max-w-lg text-lg leading-relaxed text-muted"
            >
              We&apos;re TBJ Growth Tech. We work with UK and US businesses on websites, Meta and Google ads, and the
              automation that follows up on every enquiry.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4"
            >
              <Link
                href="/book-a-call"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Book a free strategy call
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="#work" className="text-sm font-semibold text-foreground underline underline-offset-[6px] decoration-border decoration-2 transition-colors hover:decoration-brand-500">
                See our work
              </Link>
            </motion.div>

            {socialLinks.length > 0 && (
              <div className="mt-10 flex items-center gap-4 text-caption">
                {socialLinks.map((s) => {
                  const Icon = s.icon;
                  return (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="transition-colors hover:text-brand-500">
                      <Icon className="h-[18px] w-[18px]" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <motion.figure
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-card">
              <Image
                src="/we.jpg"
                alt="The TBJ Growth Tech team in the office"
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-sm text-caption">The TBJ team, the people you&apos;ll actually work with.</figcaption>
          </motion.figure>
        </div>

        <dl className="mt-16 grid grid-cols-2 border-t border-border lg:mt-24 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col-reverse justify-end py-7 lg:py-9 ${i > 0 ? "lg:border-l lg:border-border lg:pl-8" : ""} ${
                i % 2 === 1 ? "border-l border-border pl-6 lg:pl-8" : ""
              }`}
            >
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="mt-1 text-4xl font-semibold tracking-tight text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
