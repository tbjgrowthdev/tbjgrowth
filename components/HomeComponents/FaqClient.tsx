"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, ChevronDown, Calendar, ArrowRight } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export default function FaqClient({ dbFaqs }: { dbFaqs?: FaqItem[] }) {
  const faqs = dbFaqs || [];
  const hasFaqs = faqs.length > 0;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-20 lg:py-28 bg-card transition-colors duration-500">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {hasFaqs ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-14"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-4">
                <HelpCircle className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
                <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
                  Good to Know
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">
                Frequently Asked Questions
              </h2>
            </motion.div>

            <div className="divide-y divide-border">
              {faqs.map((faq, i) => (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 py-6 text-left"
                  >
                    <span className="font-semibold text-foreground">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 flex-shrink-0 text-brand-orange-deep dark:text-brand-orange-light transition-transform duration-300 ${
                        openIndex === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <p className="pb-6 text-muted leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-6">
              <HelpCircle className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
              <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
                Got Questions?
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Ask Us Directly</h2>
            <p className="text-lg text-muted leading-relaxed mb-8 max-w-xl mx-auto">
              We&apos;re still building out our FAQ — in the meantime, book a free call and
              we&apos;ll answer whatever you&apos;re wondering about.
            </p>
            <motion.a
              href="/book-a-call"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold rounded-xl shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:shadow-brand-orange/35 transition-shadow group"
            >
              <Calendar className="w-4 h-4" />
              Book a Call
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.a>
          </motion.div>
        )}
      </div>
    </section>
  );
}
