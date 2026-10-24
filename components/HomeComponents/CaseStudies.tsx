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

type WorkItem = {
  key: string;
  href: string;
  title: string;
  meta: string;
  badge?: string | null;
  image: string | null;
  alt: string;
};

// Shown until real case studies are published in the CMS: our own sample builds.
const sampleWork: WorkItem[] = [
  {
    key: "boreal",
    href: "/landing-pages/boreal",
    title: "Boreal",
    meta: "Fashion e-commerce · Landing page",
    image: "/fashionhero.jpg",
    alt: "Boreal winter outerwear landing page",
  },
  {
    key: "cedar-cove",
    href: "/landing-pages/cedar-cove",
    title: "Cedar Cove Resort",
    meta: "Hospitality · Landing page",
    image: "/resort-hero.jpg",
    alt: "Cedar Cove Resort landing page",
  },
  {
    key: "nolen",
    href: "/landing-pages/date-gur",
    title: "Nolen",
    meta: "Food & grocery · Landing page",
    image: "/jhola-gur.jpg",
    alt: "Nolen date jaggery landing page",
  },
];

function WorkTile({ item, index }: { item: WorkItem; index: number }) {
  const wide = index % 3 === 0;
  return (
    <Reveal delay={wide ? 0 : (index % 3) * 0.06} className={wide ? "md:col-span-2" : ""}>
      <Link href={item.href} className="group relative block overflow-hidden rounded-3xl bg-charcoal">
        <div className={`relative ${wide ? "aspect-[4/3] md:aspect-[21/9]" : "aspect-[4/3]"}`}>
          {item.image && isValidImageSrc(item.image) ? (
            <Image
              src={item.image.startsWith("/") ? item.image : cloudinaryUrl(item.image)}
              alt={item.alt}
              fill
              sizes={wide ? "(min-width: 1280px) 1216px, 100vw" : "(min-width: 768px) 50vw, 100vw"}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-charcoal" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 sm:p-8">
            <div>
              <p className="text-sm text-white/75">{item.meta}</p>
              <h3 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">{item.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {item.badge && (
                <span className="hidden rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-charcoal sm:inline">
                  {item.badge}
                </span>
              )}
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <ArrowUpRight className="h-5 w-5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}

export default function CaseStudies({ caseStudies }: { caseStudies: CaseStudy[] }) {
  const items: WorkItem[] =
    caseStudies.length > 0
      ? caseStudies.map((s) => ({
          key: s.id,
          href: `/case-studies/${s.slug}`,
          title: s.title,
          meta: `${s.clientName} · ${s.industry}`,
          badge: s.results,
          image: s.featuredImage,
          alt: s.featuredImageAlt || s.title,
        }))
      : sampleWork;

  return (
    <section id="work" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <h2 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
            Recent work
          </h2>
          <Link
            href="/case-studies"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-[6px] decoration-border decoration-2 transition-colors hover:decoration-brand-500"
          >
            All case studies
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:mt-14">
          {items.map((item, i) => (
            <WorkTile key={item.key} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
