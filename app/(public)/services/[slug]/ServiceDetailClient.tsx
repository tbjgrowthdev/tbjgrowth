"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Sparkles, ChevronDown, HelpCircle, Star } from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";
import { parseFeatures, parseProcess, parseDeliverables } from "@/lib/service-content";

type Faq = { id: string; question: string; answer: string };

type Service = {
  id: string;
  slug?: string | null;
  title: string;
  subtitle?: string | null;
  description: string;
  detailTitle?: string | null;
  detailIntro?: string | null;
  content?: string | null;
  iconName: string;
  features?: string | null;
  process?: string | null;
  deliverables?: string | null;
  statValue?: string | null;
  statLabel?: string | null;
  gradient?: string | null;
  faqs?: Faq[];
};

export default function ServiceDetailClient({ service }: { service: Service }) {
  const Icon = getIcon(service.iconName || "Circle");
  const gradient = service.gradient || "from-brand-orange-deep to-brand-orange";
  const bgGradient = gradient.replace(/-\d{3}/g, "$&/10");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const heading = service.detailTitle || service.title;
  const intro = service.detailIntro || service.description;

  const featuresList = parseFeatures(service.features);
  const processSteps = parseProcess(service.process);
  const deliverablesList = parseDeliverables(service.deliverables);
  const faqList = service.faqs || [];

  return (
    <main className="relative bg-background transition-colors duration-500">
      {/* Hero — H1 + Intro */}
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
            {heading}
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
            {intro}
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
              {service.statLabel && <div className="text-sm text-caption">{service.statLabel}</div>}
            </motion.div>
          )}
        </div>
      </section>

      {/* What's Included */}
      {featuresList.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">What&apos;s Included</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featuresList.map((feature, i) => {
                const text = typeof feature === "string" ? feature : feature.text;
                const iconName = typeof feature === "string" ? undefined : feature.icon;
                const FeatureIcon = getIcon(iconName || "CheckCircle2");
                return (
                  <motion.div
                    key={text}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 bg-card rounded-2xl p-5 border border-border hover:border-accent-border transition-colors"
                  >
                    <div className={`flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br ${bgGradient}`}>
                      <FeatureIcon className="w-5 h-5 text-muted" />
                    </div>
                    <span className="font-medium text-foreground">{text}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Our Process */}
      {processSteps.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-10">Our Process</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {processSteps.map((step, i) => (
                <motion.div
                  key={step.step ?? i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="relative"
                >
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-bold mb-4`}
                  >
                    {step.step ?? i + 1}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* What You Get */}
      {deliverablesList.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-8">What You Get</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-6 lg:p-8 rounded-2xl bg-card border border-border">
              {deliverablesList.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2.5"
                >
                  <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span className="text-sm text-muted">{item}</span>
                </motion.div>
              ))}
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

      {/* FAQ */}
      {faqList.length > 0 && (
        <section className="relative pb-16 lg:pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-8">
              <HelpCircle className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
            </div>
            <div className="divide-y divide-border">
              {faqList.map((faq, i) => (
                <div key={faq.id}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="font-medium text-foreground">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 text-brand-orange-deep dark:text-brand-orange-light transition-transform duration-300 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? "auto" : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-5 text-muted leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </motion.div>
                </div>
              ))}
            </div>
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
