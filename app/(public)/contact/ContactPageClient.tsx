// app/contact/page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Calendar,
  Building2,
  Globe,
  Linkedin,
  Twitter,
  Instagram,
} from "lucide-react";
// import Navbar from "@/components/homethreecomponents/Navbar";
// import Footer from "@/components/homethreecomponents/Footer";
import { submitContactForm } from "@/app/(admin)/actions/forms";

type SiteSettings = {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
} | null;

function getContactInfo(settings: SiteSettings | undefined) {
  const email = settings?.email || "hello@tbjgrowth.co.uk";
  const phone = settings?.phone || "+44 (0) 123 456 7890";
  const address = settings?.address || "London, United Kingdom";

  return [
    {
      icon: Mail,
      label: "Email Us",
      value: email,
      href: `mailto:${email}`,
      description: "We'll reply within 24 hours",
    },
    {
      icon: Phone,
      label: "Call Us",
      value: phone,
      href: `tel:${phone.replace(/[^\d+]/g, "")}`,
      description: "Mon-Fri, 9am-6pm GMT",
    },
    {
      icon: MapPin,
      label: "Visit Us",
      value: address,
      href: "#",
      description: "By appointment only",
    },
    {
      icon: Clock,
      label: "Business Hours",
      value: "Monday - Friday",
      href: "#",
      description: "9:00 AM - 6:00 PM GMT",
    },
  ];
}

// FAQ quick links
const quickLinks = [
  "Web Development",
  "SEO Services",
  "Social Media Marketing",
  "Paid Advertising",
  "CRM Solutions",
  "Business Automation",
];

export default function ContactPageClient({ settings }: { settings?: SiteSettings }) {
  const contactInfo = getContactInfo(settings);
  const socialLinks = [
    { icon: Linkedin, href: settings?.linkedinUrl, label: "LinkedIn" },
    { icon: Twitter, href: settings?.twitterUrl, label: "Twitter" },
    { icon: Instagram, href: settings?.instagramUrl, label: "Instagram" },
  ].filter((social): social is typeof social & { href: string } => Boolean(social.href));

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    company: "",
    service: "",
    message: "",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const message = formState.service
      ? `Service interested in: ${formState.service}\n\n${formState.message}`
      : formState.message;

    const result = await submitContactForm({
      name: formState.name,
      email: formState.email,
      company: formState.company,
      message,
      source: "Contact Page",
    });

    if (result.success) {
      setIsSubmitted(true);
      setFormState({ name: "", email: "", company: "", service: "", message: "" });
      setTimeout(() => setIsSubmitted(false), 5000);
    } else {
      setSubmitError("Something went wrong sending your message. Please try again or email us directly.");
    }
    setIsSubmitting(false);
  };

  return (
    <main className="relative bg-white dark:bg-gray-950 transition-colors duration-500">
      {/* <Navbar /> */}

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-blue-500/10"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-6"
          >
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Get In Touch</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight"
          >
            Let's{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Talk
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto"
          >
            Ready to grow? Fill out the form and we'll get back to you within 24 hours.
          </motion.p>
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="relative pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-10 lg:gap-14">
            {/* Form - Left 2 columns */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl p-8 lg:p-10"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Send Us a Message
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8">
                  Fill out the form below and we'll get back to you within 24 hours.
                </p>

                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Message Sent!</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Thanks for reaching out. We'll get back to you within 24 hours.
                    </p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formState.name}
                          onChange={handleChange}
                          required
                          placeholder="John Smith"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formState.email}
                          onChange={handleChange}
                          required
                          placeholder="john@company.com"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Company */}
                      <div>
                        <label htmlFor="company" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Company Name
                        </label>
                        <input
                          type="text"
                          id="company"
                          name="company"
                          value={formState.company}
                          onChange={handleChange}
                          placeholder="Your Company Ltd"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Service */}
                      <div>
                        <label htmlFor="service" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Service Interested In
                        </label>
                        <select
                          id="service"
                          name="service"
                          value={formState.service}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                          <option value="">Select a service</option>
                          <option value="web">Web Development</option>
                          <option value="seo">SEO & Content</option>
                          <option value="social">Social Media Marketing</option>
                          <option value="ads">Paid Advertising</option>
                          <option value="crm">CRM Solutions</option>
                          <option value="automation">Business Automation</option>
                          <option value="other">Other / Multiple</option>
                        </select>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Your Message *
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formState.message}
                        onChange={handleChange}
                        required
                        rows={5}
                        placeholder="Tell us about your project, goals, and how we can help..."
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      />
                    </div>

                    {/* Submit */}
                    {submitError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
                    )}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 transition-shadow group disabled:opacity-50"
                    >
                      <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                    </motion.button>
                  </form>
                )}
              </motion.div>
            </div>

            {/* Contact Info - Right 1 column */}
            <div className="space-y-6">
              {/* Info Cards */}
              {contactInfo.map((info, index) => {
                const Icon = info.icon;
                return (
                  <motion.a
                    key={info.label}
                    href={info.href}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="block p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 group-hover:scale-110 transition-transform">
                        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {info.label}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {info.value}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </motion.a>
                );
              })}

              {/* Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              >
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
                  Services We Offer
                </h4>
                <div className="space-y-2">
                  {quickLinks.map((link) => (
                    <a
                      key={link}
                      href="/services"
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                    >
                      <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      {link}
                    </a>
                  ))}
                </div>
              </motion.div>

              {/* Social Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-3 p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              >
                <span className="text-sm text-gray-500 dark:text-gray-400">Follow us:</span>
                {socialLinks.length === 0 ? (
                  <span className="text-sm text-gray-400 dark:text-gray-600">Coming soon</span>
                ) : (
                  socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gradient-to-br hover:from-blue-500 hover:to-purple-500 hover:text-white transition-all"
                    >
                      <social.icon className="w-4 h-4" />
                    </a>
                  ))
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative p-10 lg:p-14 text-center">
              <Calendar className="w-10 h-10 text-white/80 mx-auto mb-4" />
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                Prefer a Quick Call?
              </h2>
              <p className="text-white/80 mb-6 max-w-md mx-auto">
                Schedule a 15-minute discovery call. No pressure, just a conversation about your goals.
              </p>
              <motion.a
                href="#"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
              >
                <Calendar className="w-5 h-5" />
                <span>Book a Discovery Call</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* <Footer /> */}
    </main>
  );
}