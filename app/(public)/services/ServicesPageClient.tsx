// app/services/page.tsx
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Star,
} from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";
import { parseFeatures, parseProcess, parseDeliverables } from "@/lib/service-content";

type Service = {
  id: string;
  slug?: string | null;
  iconName: string;
  title: string;
  subtitle?: string | null;
  description: string;
  features?: string | null;
  process?: string | null;
  deliverables?: string | null;
  gradient?: string | null;
};

export default function ServicesPageClient({ services }: { services: Service[] }) {
  return (
    <main className="relative bg-background transition-colors duration-500">
      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-brand-orange/10"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cream to-ivory dark:from-brand-orange/10 dark:to-brand-orange-light/10 border border-brand-orange/20 dark:border-brand-orange/20 rounded-full mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
            <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">What We Offer</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 tracking-tight"
          >
            Our{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              Services
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted max-w-2xl mx-auto"
          >
            End-to-end digital services to build your presence, attract your audience, and scale your business with AI-powered efficiency.
          </motion.p>
        </div>
      </section>

      {/* Services Detail Sections */}
      {services.map((service, index) => {
        const isEven = index % 2 === 0;
        const Icon = getIcon(service.iconName || "Globe");
        const gradient = service.gradient || "from-brand-orange-deep to-brand-orange";
        const bgGradient = gradient.replace(/-\d{3}/g, "$&/10");
        const anchor = service.slug || service.id;

        const featuresList = parseFeatures(service.features);
        const processSteps = parseProcess(service.process);
        const deliverablesList = parseDeliverables(service.deliverables);
        const hasVisualColumn = processSteps.length > 0 || deliverablesList.length > 0;

        return (
          <section
            key={service.id}
            id={anchor}
            className={`relative py-20 lg:py-24 scroll-mt-20 ${isEven ? "bg-background" : "bg-card"
              } transition-colors duration-500`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className={`grid gap-12 lg:gap-16 items-center ${hasVisualColumn ? "lg:grid-cols-2" : ""} ${!isEven && hasVisualColumn ? "lg:grid-flow-dense" : ""
                  }`}
              >
                {/* Content */}
                <div className={!isEven && hasVisualColumn ? "lg:col-start-2" : ""}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Icon */}
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg mb-6`}>
                      <Icon className="w-8 h-8" />
                    </div>

                    <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-3">
                      {service.title}
                    </h2>
                    {service.subtitle && <p className="text-lg text-muted mb-2">{service.subtitle}</p>}
                    <p className="text-muted leading-relaxed mb-8">{service.description}</p>

                    {/* Features */}
                    {featuresList.length > 0 && (
                      <div className="space-y-3 mb-8">
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Key Features</h4>
                        {featuresList.map((feature) => (
                          <div key={feature.text} className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-sm text-muted">{feature.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center gap-4">
                      <motion.a
                        href="/contact"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${gradient} text-white font-semibold rounded-xl shadow-lg group`}
                      >
                        <span>Get Started with {service.title.split("&")[0].trim()}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </motion.a>
                      <Link
                        href={`/services/${anchor}`}
                        className="text-sm font-semibold text-muted hover:text-foreground transition-colors"
                      >
                        View Full Details →
                      </Link>
                    </div>
                  </motion.div>
                </div>

                {/* Visual - Process + Deliverables */}
                {hasVisualColumn && (
                  <div className={!isEven ? "lg:col-start-1" : ""}>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="space-y-6"
                    >
                      {/* Process */}
                      {processSteps.length > 0 && (
                        <div className={`p-6 lg:p-8 rounded-2xl bg-gradient-to-br ${bgGradient} border border-border`}>
                          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Our Process</h4>
                          <div className="space-y-4">
                            {processSteps.map((step) => (
                              <div key={step.step} className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                                  {String(step.step).padStart(2, "0")}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-foreground text-sm">{step.title}</h5>
                                  <p className="text-sm text-muted">{step.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Deliverables */}
                      {deliverablesList.length > 0 && (
                        <div className="p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-accent-border transition-colors shadow-sm">
                          <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">What You Get</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {deliverablesList.map((item) => (
                              <div key={item} className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                <span className="text-sm text-muted">{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* Bottom CTA */}
      <section className="relative py-20 lg:py-28 bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-background rounded-3xl p-10 lg:p-14 shadow-2xl border border-border"
          >
            <Sparkles className="w-12 h-12 text-brand-orange-deep dark:text-brand-orange-light mx-auto mb-6" />
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Ready to Grow Your Business?
            </h2>
            <p className="text-lg text-muted mb-8 max-w-lg mx-auto">
              Book a free strategy call and we&apos;ll create a custom growth plan tailored to your business goals.
            </p>
            <motion.a
              href="/contact"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-bold rounded-2xl shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow"
            >
              <Calendar className="w-5 h-5" />
              <span>Book a Free Strategy Call</span>
              <ArrowRight className="w-5 h-5" />
            </motion.a>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
