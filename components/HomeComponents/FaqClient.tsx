"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import Reveal from "@/components/home/Reveal";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export default function FaqClient({ dbFaqs }: { dbFaqs?: FaqItem[] }) {
  const faqs = dbFaqs || [];
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-card py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <p className="eyebrow mb-5">FAQ</p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
              Good to <span className="serif-accent">know</span>.
            </h2>
            <p className="mt-6 text-muted">
              Something we haven&apos;t covered?{" "}
              <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 hover:text-brand-500">
                Ask us directly
              </Link>
              .
            </p>
          </Reveal>

          <div className="lg:col-span-8">
            {faqs.length > 0 ? (
              <ul className="border-t border-border">
                {faqs.map((faq, i) => {
                  const open = openIndex === i;
                  return (
                    <li key={faq.id} className="border-b border-border">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenIndex(open ? null : i)}
                        className="flex w-full items-center justify-between gap-6 py-6 text-left"
                      >
                        <span className="text-lg font-medium tracking-tight text-foreground">{faq.question}</span>
                        <Plus
                          className={`h-5 w-5 shrink-0 text-caption transition-transform duration-300 ${open ? "rotate-45 text-brand-500" : ""}`}
                        />
                      </button>
                      <div
                        className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden">
                          <p className="max-w-2xl whitespace-pre-line pb-6 leading-relaxed text-muted">{faq.answer}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Reveal className="rounded-2xl border border-dashed border-border p-10">
                <h3 className="font-heading text-2xl font-medium tracking-tight text-foreground">Ask us directly</h3>
                <p className="mt-3 max-w-md text-muted">
                  We&apos;re still building out our FAQ. In the meantime, book a free call and we&apos;ll answer whatever
                  you&apos;re wondering about.
                </p>
                <Link
                  href="/book-a-call"
                  className="group mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-500"
                >
                  Book a call
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
