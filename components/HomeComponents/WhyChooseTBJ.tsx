"use client";

import Reveal from "@/components/home/Reveal";

export const benefits = [
  {
    id: "results-first-reporting",
    title: "Results-first reporting",
    description:
      "You get a real dashboard and a monthly report tied directly to leads and revenue, not just vanity reach and impressions.",
    stats: [
      { value: "100%", label: "Revenue-focused" },
      { value: "Monthly", label: "Executive reports" },
    ],
  },
  {
    id: "one-team-every-channel",
    title: "One team, every channel",
    description:
      "Website, ads, SEO and CRM automation come from the exact same team, so nothing gets lost in handoffs between vendors.",
    stats: [
      { value: "1", label: "Unified team" },
      { value: "4-in-1", label: "Core services" },
    ],
  },
  {
    id: "ai-powered-efficiency",
    title: "AI-powered efficiency",
    description:
      "We use AI tools to speed up content production, ad testing and lead follow-up. The human strategy stays human; the repetitive work doesn't.",
    stats: [
      { value: "85%", label: "Time saved" },
      { value: "24/7", label: "Automation" },
    ],
  },
  {
    id: "direct-access",
    title: "Direct access",
    description:
      "A dedicated WhatsApp channel and direct access to your account lead, with no impersonal support ticket queues or long delays.",
    stats: [
      { value: "<15min", label: "Response time" },
      { value: "Direct", label: "WhatsApp channel" },
    ],
  },
  {
    id: "full-transparency",
    title: "Full transparency",
    description:
      "No black-box reporting. You see exactly what's spent, what revenue it returned, and what strategic changes happen next.",
    stats: [
      { value: "100%", label: "Visibility" },
      { value: "Real-time", label: "Dashboard access" },
    ],
  },
  {
    id: "built-for-uk-us",
    title: "Built for UK & US businesses",
    description:
      "Aligned with UK & US business hours, offering GDPR-aware data handling, and specialised in scaling Western markets.",
    stats: [
      { value: "100%", label: "GDPR compliant" },
      { value: "US/UK", label: "Timezone alignment" },
    ],
  },
];

const processSteps = [
  {
    title: "Discovery & strategy",
    description:
      "We dig into your goals, audience and competitors to build a growth strategy tailored to you.",
    details: ["Business & competitor analysis", "Audience research & personas", "Goal setting & KPI definition", "Technology stack planning"],
  },
  {
    title: "Build & launch",
    description:
      "We design and develop your websites, campaigns and automation workflows with speed and precision.",
    details: ["UI/UX design & prototyping", "Development & integration", "Quality assurance & testing", "Deployment & go-live"],
  },
  {
    title: "Attract & convert",
    description:
      "We drive qualified traffic through multi-channel campaigns and optimise the path to conversion.",
    details: ["SEO & content marketing", "Paid advertising campaigns", "Social media management", "Conversion rate optimisation"],
  },
  {
    title: "Automate & scale",
    description:
      "We implement AI-powered automation and keep optimising to scale your growth efficiently.",
    details: ["Workflow automation setup", "AI & chatbot integration", "Analytics & BI dashboards", "Continuous optimisation"],
  },
];

export default function WhyChooseTBJ() {
  return (
    <section id="why-tbj" className="bg-card py-24 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <Reveal className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <p className="eyebrow mb-5">Why TBJ</p>
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
                An agency that answers to <span className="serif-accent">revenue</span>.
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-muted">
                Six things we hold ourselves to on every engagement.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:col-span-8">
            {benefits.map((b, i) => (
              <Reveal key={b.id} delay={(i % 2) * 0.06} className="bg-background p-7 lg:p-9">
                <h3 className="text-xl font-medium tracking-tight text-foreground">{b.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">{b.description}</p>
                <dl className="mt-8 flex gap-8 border-t border-border pt-5">
                  {b.stats.map((s) => (
                    <div key={s.label}>
                      <dd className="font-heading text-2xl font-semibold tracking-tight text-foreground">{s.value}</dd>
                      <dt className="mt-0.5 text-xs text-caption">{s.label}</dt>
                    </div>
                  ))}
                </dl>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Process */}
        <div className="mt-28 lg:mt-40">
          <Reveal className="max-w-2xl">
            <p className="eyebrow mb-5">Our process</p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl">
              From first call to <span className="serif-accent">compounding</span> growth.
            </h2>
          </Reveal>

          <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            {processSteps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.07}>
                <li className="border-t border-foreground pt-5">
                  <span className="font-mono text-xs text-caption">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-xl font-medium tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted">{step.description}</p>
                  <ul className="mt-5 space-y-2 text-sm text-muted">
                    {step.details.map((d) => (
                      <li key={d} className="flex gap-2.5">
                        <span className="mt-[9px] h-px w-3 shrink-0 bg-brand-500" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
