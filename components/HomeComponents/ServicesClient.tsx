"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";
import { fallbackServices } from "@/lib/fallback-services";
import Reveal from "@/components/home/Reveal";

export default function ServicesClient({ dbServices }: { dbServices?: any[] }) {
  const services = dbServices && dbServices.length > 0 ? dbServices : fallbackServices;

  return (
    <section id="services" className="bg-background py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow mb-5">Services</p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
              Everything to <span className="serif-accent">build, attract</span> and scale.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-6 lg:col-start-7 lg:pt-10">
            <p className="text-lg leading-relaxed text-muted">
              One team covers the website, the traffic and the follow-up, so nothing gets lost in a handoff between
              vendors.
            </p>
          </Reveal>
        </div>

        <ul className="mt-16 border-t border-border lg:mt-24">
          {services.map((service, i) => {
            const Icon = getIcon(service.iconName || "Circle");
            const stat = service.statValue || service.stat;
            return (
              <li key={service.id} className="border-b border-border">
                <Reveal delay={Math.min(i, 4) * 0.04}>
                  <Link
                    href={`/services/${service.slug || service.id}`}
                    className="group grid items-start gap-x-8 gap-y-3 py-8 transition-colors sm:grid-cols-[3rem_1fr_auto] lg:grid-cols-[4rem_minmax(0,1.1fr)_minmax(0,1.4fr)_9rem_2rem] lg:items-center lg:py-10"
                  >
                    <span className="font-mono text-sm text-caption">{String(i + 1).padStart(2, "0")}</span>

                    <h3 className="flex items-center gap-3 text-2xl font-medium tracking-tight text-foreground transition-colors group-hover:text-brand-500 lg:text-[1.75rem]">
                      <Icon className="hidden h-5 w-5 shrink-0 text-caption transition-colors group-hover:text-brand-500 sm:block lg:hidden xl:block" />
                      {service.title}
                    </h3>

                    <p className="text-[15px] leading-relaxed text-muted sm:col-start-2 lg:col-start-3">
                      {service.description}
                    </p>

                    <div className="hidden text-right lg:block">
                      {stat && (
                        <>
                          <div className="font-heading text-2xl font-semibold tracking-tight text-foreground">{stat}</div>
                          <div className="text-xs text-caption">{service.statLabel}</div>
                        </>
                      )}
                    </div>

                    <ArrowUpRight className="hidden h-5 w-5 text-caption transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-500 sm:row-start-1 sm:col-start-3 sm:block sm:justify-self-end lg:col-start-5 lg:row-start-auto" />
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
