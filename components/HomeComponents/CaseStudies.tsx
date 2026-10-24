"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { isValidImageSrc } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary-url";
import Reveal from "@/components/home/Reveal";

type CaseStudy = {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  industry: string;
  serviceType: string;
  excerpt: string | null;
  results: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
};

function CaseStudyCard({ study, index }: { study: CaseStudy; index: number }) {
  return (
    <Reveal delay={(index % 3) * 0.07}>
      <Link href={`/case-studies/${study.slug}`} className="group block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-card">
          {isValidImageSrc(study.featuredImage) ? (
            <Image
              src={cloudinaryUrl(study.featuredImage)}
              alt={study.featuredImageAlt || study.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 flex items-end bg-charcoal p-6">
              <span className="font-heading text-3xl font-semibold tracking-tight text-white/90">{study.clientName}</span>
            </div>
          )}
          {study.results && (
            <span className="absolute bottom-4 left-4 rounded-full bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground">
              {study.results}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">
              {study.industry} · {study.clientName}
            </p>
            <h3 className="text-xl font-medium leading-snug tracking-tight text-foreground transition-colors group-hover:text-brand-500">
              {study.title}
            </h3>
            {study.excerpt && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-muted">{study.excerpt}</p>}
          </div>
          <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-caption transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </div>
      </Link>
    </Reveal>
  );
}

export default function CaseStudies({ caseStudies }: { caseStudies: CaseStudy[] }) {
  return (
    <section id="case-studies" className="bg-background py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow mb-5">Selected work</p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
              Real results from <span className="serif-accent">real</span> clients.
            </h2>
          </div>
          <Link
            href="/case-studies"
            className="group inline-flex items-center gap-1.5 self-start text-sm font-semibold text-foreground underline decoration-border decoration-2 underline-offset-[6px] transition-colors hover:decoration-brand-500 lg:self-auto"
          >
            All case studies
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {caseStudies.length === 0 ? (
          <Reveal className="mt-14 rounded-2xl border border-dashed border-border px-8 py-20 text-center">
            <h3 className="font-heading text-2xl font-medium tracking-tight text-foreground">
              New success stories coming soon
            </h3>
            <p className="mx-auto mt-3 max-w-md text-muted">
              We&apos;re putting the finishing touches on our latest client results. Check back shortly.
            </p>
          </Reveal>
        ) : (
          <div className="mt-14 grid gap-x-8 gap-y-14 md:grid-cols-2 lg:mt-20 lg:grid-cols-3">
            {caseStudies.map((study, index) => (
              <CaseStudyCard key={study.id} study={study} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
