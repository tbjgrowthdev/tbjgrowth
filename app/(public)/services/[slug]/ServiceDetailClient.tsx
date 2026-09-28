"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Sparkles } from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";

type Feature = { icon?: string; text: string };

type Service = {
  id: string;
  slug?: string | null;
  title: string;
  subtitle?: string | null;
  description: string;
  content?: string | null;
  iconName: string;
  features?: string | Feature[] | null;
  statValue?: string | null;
  statLabel?: string | null;
  gradient?: string | null;
};

export default function ServiceDetailClient({ service }: { service: Service }) {
  const Icon = getIcon(service.iconName || "Circle");
  const gradient = service.gradient || "from-brand-orange-deep to-brand-orange";
  const bgGradient = gradient.replace(/-\d{3}/g, "$&/10");

  const featuresList: Feature[] = (() => {
    if (!service.features) return [];
    if (typeof service.features === "string") {
      try {
        return JSON.parse(service.features);
      } catch {
        return [];
      }
    }
    return service.features;
  })();

  return (
    <main className="relative bg-background transition-colors duration-500">
      {/* Hero */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br ${bgGradient}`}
          />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              All Services
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg mb-6`}
          >
            <Icon className="w-8 h-8" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight"
          >
            {service.title}
          </motion.h1>

          {service.subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-muted mb-2"
            >
              {service.subtitle}
            </motion.p>
          )}

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-muted leading-relaxed max-w-2xl"
          >
            {service.description}
          </motion.p>

          {service.statValue && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-3 mt-8 bg-stat rounded-2xl px-6 py-4 border border-border"
            >
              <div className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {service.statValue}
              </div>
              {service.statLabel && (
                <div className="text-sm text-caption">{service.statLabel}</div>
              )}
            </motion.div>
          )}
        </div>
      </section>

      {/* Features */}
      {featuresList.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuresList.map((feature, i) => {
                const FeatureIcon = getIcon(feature.icon || "CheckCircle2");
                return (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 bg-card rounded-2xl p-5 border border-border hover:border-accent-border transition-colors"
                  >
                    <div className={`flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br ${bgGradient}`}>
                      <FeatureIcon className="w-5 h-5 text-muted" />
                    </div>
                    <span className="font-medium text-foreground">{feature.text}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Long-form content, if the admin has written any */}
      {service.content && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div
              className="prose prose-lg dark:prose-invert prose-headings:font-bold prose-a:text-brand-orange-deep dark:prose-a:text-brand-orange-light hover:prose-a:text-brand-orange prose-pre:overflow-x-auto prose-img:rounded-2xl"
              dangerouslySetInnerHTML={{ __html: service.content }}
            />
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="relative pb-20 lg:pb-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${gradient}`} />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

            <div className="relative p-10 lg:p-14 text-center">
              <Sparkles className="w-10 h-10 text-white/80 mx-auto mb-4" />
              <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">
                Ready to Get Started with {service.title}?
              </h2>
              <p className="text-white/80 mb-6 max-w-md mx-auto">
                Book a free strategy call and we&apos;ll show you exactly how we can help.
              </p>
              <motion.a
                href="/book-a-call"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-off-black font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
              >
                <Calendar className="w-5 h-5" />
                <span>Book a Conversation</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
