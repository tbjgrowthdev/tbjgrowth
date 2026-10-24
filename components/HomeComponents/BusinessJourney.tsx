"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Reveal from "@/components/home/Reveal";

const stages = [
  {
    id: "build",
    label: "Build",
    description:
      "We design and launch your website, brand and digital foundation first, because sending paid traffic to a weak site burns budget.",
    items: [
      ["Website design", "Responsive and fast"],
      ["Brand identity", "Cohesive and memorable"],
      ["UX architecture", "User-centred"],
      ["Mobile-first", "Every device"],
    ],
    metric: { value: "48hrs", label: "Average launch time" },
  },
  {
    id: "attract",
    label: "Attract",
    description:
      "We drive qualified traffic through SEO, social content and paid campaigns once there is somewhere good for that traffic to land.",
    items: [
      ["SEO strategy", "Top 3 rankings"],
      ["Paid ads", "ROAS 4.5x"],
      ["Social media", "2.5M+ reach"],
      ["Content marketing", "10k+ visitors"],
    ],
    metric: { value: "+245%", label: "Traffic increase" },
  },
  {
    id: "convert",
    label: "Convert",
    description:
      "We optimise the on-page and on-call experience so visitors and leads actually become customers, not just numbers in a dashboard.",
    items: [
      ["Landing pages", "4.2% conversion rate"],
      ["CRM setup", "Automated pipeline"],
      ["Lead capture", "500+ leads a month"],
      ["A/B testing", "Continuous"],
    ],
    metric: { value: "+180%", label: "Lead growth" },
  },
  {
    id: "automate",
    label: "Automate",
    description:
      "We connect CRM, follow-up sequences and AI systems so no lead sits untouched for more than a few minutes.",
    items: [
      ["AI workflows", "Smart automation"],
      ["Chatbot", "24/7 support"],
      ["Email sequences", "42% open rate"],
      ["Integrations", "50+ tools"],
    ],
    metric: { value: "85%", label: "Time saved" },
  },
  {
    id: "scale",
    label: "Scale",
    description:
      "We double down on what the data shows is working and cut what isn't, on a monthly reporting cycle.",
    items: [
      ["Analytics suite", "Real-time data"],
      ["BI reports", "Monthly insights"],
      ["Growth strategy", "Custom roadmap"],
      ["Performance", "99.9% uptime"],
    ],
    metric: { value: "+320%", label: "Revenue growth" },
  },
];

export default function BusinessJourney() {
  const [active, setActive] = useState(0);
  const stage = stages[active];

  return (
    <section id="journey" className="bg-charcoal py-24 text-[#F2ECE8] lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-5 !text-white/50">How we work</p>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            Your business <span className="serif-accent !text-brand-300">journey</span>, in order.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-white/60">
            This isn&apos;t a slogan. It&apos;s the sequence we run for every client, because skipping a step is the most
            common reason marketing spend gets wasted.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-12 lg:gap-16">
          <div
            role="tablist"
            aria-label="Journey stages"
            className="-mx-5 flex gap-1 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:col-span-4 lg:flex-col lg:overflow-visible"
          >
            {stages.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={`group flex shrink-0 items-baseline gap-4 border-b py-4 text-left transition-colors lg:py-5 ${
                  active === i ? "border-brand-400 text-white" : "border-white/10 text-white/40 hover:text-white/70"
                }`}
              >
                <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-heading text-2xl font-medium tracking-tight lg:text-4xl">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.id}
                role="tabpanel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
                  <p className="max-w-xl text-xl leading-relaxed text-white/85 lg:text-2xl">{stage.description}</p>
                  <div className="shrink-0 sm:text-right">
                    <div className="font-heading text-6xl font-semibold tracking-tight text-brand-300 lg:text-7xl">
                      {stage.metric.value}
                    </div>
                    <div className="mt-1 text-sm text-white/50">{stage.metric.label}</div>
                  </div>
                </div>

                <dl className="mt-12 grid border-t border-white/10 sm:grid-cols-2">
                  {stage.items.map(([label, value], i) => (
                    <div
                      key={label}
                      className={`flex items-baseline justify-between gap-4 border-b border-white/10 py-5 ${
                        i % 2 === 0 ? "sm:pr-8" : "sm:border-l sm:pl-8"
                      }`}
                    >
                      <dt className="font-medium">{label}</dt>
                      <dd className="text-sm text-white/50">{value}</dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
