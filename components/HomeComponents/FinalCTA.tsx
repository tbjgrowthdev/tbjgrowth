"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/home/Reveal";

export default function FinalCTA() {
  return (
    <section id="contact" className="bg-background px-5 pb-10 pt-12 sm:px-8 lg:pb-16">
      <Reveal className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-charcoal px-8 py-20 text-[#F2ECE8] sm:px-14 lg:py-32">
        <p className="eyebrow mb-6 !text-white/50">Let&apos;s talk</p>
        <h2 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-8xl">
          Ready to <span className="serif-accent !text-brand-300">scale</span>?
        </h2>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-white/60">
          Book a free strategy call. We&apos;ll look at where your leads are leaking and tell you what we&apos;d fix first,
          whether or not you hire us.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/book-a-call"
            className="group inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-4 font-semibold text-white transition-colors hover:bg-brand-400"
          >
            Book a conversation
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/contact"
            className="font-semibold text-white underline decoration-white/25 decoration-2 underline-offset-[6px] transition-colors hover:decoration-brand-300"
          >
            Or send us a message
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
