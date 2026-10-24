"use client";

import { useState } from "react";
import { ArrowRight, ArrowUp, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { FaYoutube, FaBehance, FaDribbble } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";
import { withLocalePrefix, type LocaleConfig } from "@/lib/i18n";

// Footer data
const footerLinks = {
  services: {
    title: "Services",
    links: [
      { label: "Web Development", href: "#services" },
      { label: "SEO & Content", href: "#services" },
      { label: "Social Media", href: "#services" },
      { label: "Paid Ads", href: "#services" },
      { label: "CRM Solutions", href: "#services" },
      { label: "Automation", href: "#services" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Case Studies", href: "#case-studies" },
      { label: "Our Process", href: "#why-tbj" },
      { label: "TBJ Systems", href: "#tbj-systems" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#contact" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Free Tools", href: "#" },
      { label: "Guides", href: "#" },
      { label: "Webinars", href: "#" },
      { label: "FAQ", href: "#faq" },
      { label: "Support", href: "#" },
    ],
  },
};

type SiteSettings = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  behanceUrl?: string | null;
  dribbbleUrl?: string | null;
} | null;

export default function Footer({ settings, locale }: { settings?: SiteSettings; locale: LocaleConfig }) {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const localizedHref = (href: string) => (href.startsWith("#") ? href : withLocalePrefix(locale.prefix, href));

  const contactEmail = settings?.email || "hello@tbjgrowth.co.uk";
  const contactPhone = settings?.phone || "+44 (0) 123 456 7890";
  const contactAddress = settings?.address || "London, United Kingdom";
  const phoneHref = `tel:${contactPhone.replace(/[^\d+]/g, "")}`;

  const socialLinks = [
    { icon: Linkedin, href: settings?.linkedinUrl, label: "LinkedIn" },
    { icon: Twitter, href: settings?.twitterUrl, label: "Twitter" },
    { icon: Instagram, href: settings?.instagramUrl, label: "Instagram" },
    { icon: Facebook, href: settings?.facebookUrl, label: "Facebook" },
    { icon: FaYoutube, href: settings?.youtubeUrl, label: "YouTube" },
    { icon: FaBehance, href: settings?.behanceUrl, label: "Behance" },
    { icon: FaDribbble, href: settings?.dribbbleUrl, label: "Dribbble" },
  ].filter((social): social is typeof social & { href: string } => Boolean(social.href));

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail("");
      setTimeout(() => setIsSubscribed(false), 3000);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const columns = Object.values(footerLinks);

  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-20 sm:px-8 lg:pt-28">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Link href={withLocalePrefix(locale.prefix, "/")} className="inline-block">
              <Image src="/primarylogo.png" alt="TBJ Growth Tech" width={1000} height={200} className="h-8 w-auto dark:hidden" />
              <Image src="/primary-logo-dark.png" alt="TBJ Growth Tech" width={1000} height={200} className="hidden h-8 w-auto dark:block" />
            </Link>
            <p className="mt-6 max-w-sm leading-relaxed text-muted">
              Websites, ads and AI automation for businesses that want their growth to be measurable.
            </p>

            <form onSubmit={handleSubscribe} className="mt-8 max-w-sm">
              <label htmlFor="footer-email" className="eyebrow mb-3 block">
                Growth notes, occasionally
              </label>
              <div className="flex items-center border-b border-foreground pb-2">
                <input
                  id="footer-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-caption"
                />
                <button type="submit" aria-label="Subscribe" className="text-foreground transition-colors hover:text-brand-500">
                  <ArrowRight size={20} />
                </button>
              </div>
              {isSubscribed && <p className="mt-3 text-sm text-brand-500">Thanks, you&apos;re on the list.</p>}
            </form>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:pl-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="eyebrow mb-5 !font-semibold">{col.title}</h3>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={localizedHref(link.href)}
                        className="text-[15px] text-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-6 border-t border-border pt-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted">
            <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-foreground">
              {contactEmail}
            </a>
            <a href={phoneHref} className="transition-colors hover:text-foreground">
              {contactPhone}
            </a>
            <span>{contactAddress}</span>
          </div>
          {socialLinks.length > 0 && (
            <div className="flex items-center gap-4 text-caption">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="transition-colors hover:text-brand-500"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 text-sm text-caption sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} TBJ Growth Ltd. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">
              Privacy Policy
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Terms of Service
            </a>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("tbj-open-cookie-preferences"))}
              className="transition-colors hover:text-foreground"
            >
              Cookie Policy
            </button>
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Back to top"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
