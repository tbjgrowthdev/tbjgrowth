"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Send,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Sparkles,
  Heart,
  Shield,
  Zap,
  ChevronRight,
  ArrowUp,
} from "lucide-react";
import { FaYoutube, FaBehance, FaDribbble } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";

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
      { label: "About Us", href: "#" },
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
      { label: "Blog", href: "#" },
      { label: "Free Tools", href: "#" },
      { label: "Guides", href: "#" },
      { label: "Webinars", href: "#" },
      { label: "FAQ", href: "#" },
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

export default function Footer({ settings }: { settings?: SiteSettings }) {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

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

  return (
    <footer className="relative bg-card border-t border-border transition-colors duration-500">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-12 lg:gap-8">
          {/* Brand Column - Spans 2 */}
          <div className="lg:col-span-2">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <Link href="#" className="flex items-center group">
                <div className="relative">
                  <Image
                    src="/primarylogo.png"
                    alt="TBJ Growth Tech"
                    width={1000}
                    height={200}
                    className="h-9 w-auto dark:hidden"
                  />
                  <Image
                    src="/primary-logo-dark.png"
                    alt="TBJ Growth Tech"
                    width={1000}
                    height={200}
                    className="hidden h-9 w-auto dark:block"
                  />
                </div>
              </Link>
            </motion.div>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted leading-relaxed mb-6 max-w-sm"
            >
              We help UK businesses grow with design that converts, marketing
              that attracts, and AI that scales. From strategy to automation,
              we're your complete growth partner.
            </motion.p>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-3 mb-6"
            >
              <a
                href={`mailto:${contactEmail}`}
                className="flex items-center gap-3 text-sm text-muted hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-background group-hover:bg-tint transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                {contactEmail}
              </a>
              <a
                href={phoneHref}
                className="flex items-center gap-3 text-sm text-muted hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-background group-hover:bg-tint transition-colors">
                  <Phone className="w-4 h-4" />
                </div>
                {contactPhone}
              </a>
              <div className="flex items-center gap-3 text-sm text-muted">
                <div className="p-1.5 rounded-lg bg-background">
                  <MapPin className="w-4 h-4" />
                </div>
                {contactAddress}
              </div>
            </motion.div>

            {/* Social Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2"
            >
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <motion.a
                    key={social.label}
                    href={social.href}
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2.5 rounded-xl bg-background text-muted hover:bg-gradient-to-br hover:from-brand-orange-deep hover:to-brand-orange hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                    aria-label={social.label}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.a>
                );
              })}
            </motion.div>
          </div>

          {/* Quick Links - 3 columns */}
          {Object.values(footerLinks).map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + sectionIndex * 0.1 }}
              className="lg:col-span-1"
            >
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-colors flex items-center gap-1 group"
                    >
                      <ChevronRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          {/* Newsletter Column - Spans 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-1"
          >
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
              Newsletter
            </h3>
            <p className="text-sm text-muted mb-4">
              Get growth tips, AI insights, and exclusive offers delivered to
              your inbox.
            </p>

            {/* Subscription Form */}
            <form onSubmit={handleSubscribe} className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-3 pr-12 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent text-foreground placeholder-muted transition-all"
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white rounded-lg hover:shadow-lg hover:shadow-brand-orange/25 transition-shadow"
              >
                {isSubscribed ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </motion.button>
            </form>

            {/* Success message */}
            {isSubscribed && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium"
              >
                Thanks for subscribing! 🎉
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <p className="text-sm text-caption flex items-center gap-1">
              © {new Date().getFullYear()} TBJ Growth Ltd. All rights reserved.
              <span className="hidden sm:inline">·</span>
              <br className="sm:hidden" />
              Made with{" "}
              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 inline-block mx-0.5 animate-pulse" />{" "}
              in London
            </p>

            {/* Legal Links */}
            <div className="flex items-center gap-6">
              <a
                href="#"
                className="text-sm text-caption hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-sm text-caption hover:text-foreground transition-colors"
              >
                Terms of Service
              </a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("tbj-open-cookie-preferences"))}
                className="text-sm text-caption hover:text-foreground transition-colors"
              >
                Cookie Policy
              </button>
            </div>

            {/* Back to Top Button */}
            <motion.button
              onClick={scrollToTop}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-xl bg-background text-muted hover:bg-gradient-to-br hover:from-brand-orange-deep hover:to-brand-orange hover:text-white transition-all duration-300 shadow-sm"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </footer>
  );
}