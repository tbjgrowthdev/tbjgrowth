// app/services/page.tsx
"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Globe,
  Search,
  Share2,
  Megaphone,
  Settings,
  Workflow,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Monitor,
  Smartphone,
  Palette,
  Code2,
  Target,
  Users,
  TrendingUp,
  Mail,
  MessageSquare,
  Zap,
  BarChart3,
  MousePointerClick,
  Eye,
  Network,
  BrainCircuit,
  Cpu,
  LineChart,
  Activity,
  Layers,
  Calendar,
  Shield,
  Star,
} from "lucide-react";
import Navbar from "@/components/HomeComponents/Navbar";
import Footer from "@/components/HomeComponents/Footer";

// Services data
const services = [
  {
    id: "web-development",
    icon: Globe,
    title: "Web Design & Development",
    subtitle: "Conversion-focused websites that perform",
    description:
      "Custom-built, high-performance websites designed to convert visitors into customers. Every pixel engineered for speed, accessibility, and conversion rate optimization.",
    features: [
      "Responsive mobile-first design",
      "Next.js & React development",
      "UI/UX design & prototyping",
      "Performance optimization (98+ PageSpeed)",
      "SEO-friendly architecture",
      "CMS integration (WordPress, Headless CMS)",
    ],
    process: [
      { step: "01", title: "Discovery", desc: "Understand your brand, audience & goals" },
      { step: "02", title: "Design", desc: "Create wireframes & visual designs" },
      { step: "03", title: "Build", desc: "Develop with modern frameworks" },
      { step: "04", title: "Launch", desc: "Test, optimize & deploy" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGradient: "from-brand-orange/10 to-brand-orange-light/10",
    shadowGlow: "shadow-brand-orange/25",
    textGradient: "from-brand-orange-deep to-brand-orange",
    deliverables: ["Figma Design Files", "Source Code", "Documentation", "30 Days Support"],
  },
  {
    id: "seo",
    icon: Search,
    title: "SEO & Content Strategy",
    subtitle: "Dominate search rankings organically",
    description:
      "Data-driven SEO strategies that put you at the top of Google. From technical optimization to content that ranks and converts, we cover every aspect of search.",
    features: [
      "Technical SEO audits & fixes",
      "Keyword research & mapping",
      "On-page & off-page optimization",
      "Content strategy & creation",
      "Local SEO & Google Business Profile",
      "Monthly ranking reports",
    ],
    process: [
      { step: "01", title: "Audit", desc: "Analyze current SEO performance" },
      { step: "02", title: "Strategy", desc: "Build keyword & content plan" },
      { step: "03", title: "Optimize", desc: "Implement on-page & technical SEO" },
      { step: "04", title: "Track", desc: "Monitor rankings & traffic" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGradient: "from-charcoal/10 to-off-black/10",
    shadowGlow: "shadow-graphite/25",
    textGradient: "from-graphite to-off-black",
    deliverables: ["SEO Audit Report", "Keyword Strategy", "Content Calendar", "Monthly Reports"],
  },
  {
    id: "social-media",
    icon: Share2,
    title: "Social Media Marketing",
    subtitle: "Build an engaged community around your brand",
    description:
      "Strategic social media management across all major platforms. Content creation, community engagement, and paid social campaigns that drive real business results.",
    features: [
      "Platform strategy & management",
      "Content creation (Reels, Posts, Stories)",
      "Community engagement & growth",
      "Influencer partnerships",
      "Paid social advertising",
      "Analytics & performance reports",
    ],
    process: [
      { step: "01", title: "Strategy", desc: "Define audience & platform mix" },
      { step: "02", title: "Create", desc: "Design content calendar & assets" },
      { step: "03", title: "Engage", desc: "Post, respond & grow community" },
      { step: "04", title: "Optimize", desc: "Analyze & refine strategy" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGradient: "from-brand-orange/10 to-brand-orange-light/10",
    shadowGlow: "shadow-brand-orange/25",
    textGradient: "from-brand-orange-deep to-brand-orange",
    deliverables: ["Content Calendar", "Brand Assets", "Monthly Analytics", "Growth Strategy"],
  },
  {
    id: "paid-ads",
    icon: Megaphone,
    title: "Google & Meta Ads",
    subtitle: "ROI-driven paid advertising campaigns",
    description:
      "High-performing paid campaigns managed by certified specialists. Every pound tracked, optimized, and maximized for ROI across Google, Meta, LinkedIn, and more.",
    features: [
      "Google Ads (Search, Display, Shopping)",
      "Meta Ads (Facebook & Instagram)",
      "LinkedIn Advertising",
      "Advanced audience targeting",
      "A/B testing & optimization",
      "Conversion tracking & attribution",
    ],
    process: [
      { step: "01", title: "Research", desc: "Analyze market & competitors" },
      { step: "02", title: "Campaign", desc: "Set up targeted ad campaigns" },
      { step: "03", title: "Optimize", desc: "Test creatives & audiences" },
      { step: "04", title: "Scale", desc: "Increase budget on winners" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGradient: "from-charcoal/10 to-off-black/10",
    shadowGlow: "shadow-graphite/25",
    textGradient: "from-graphite to-off-black",
    deliverables: ["Ad Strategy Doc", "Creative Assets", "Weekly Reports", "ROI Dashboard"],
  },
  {
    id: "crm",
    icon: Settings,
    title: "CRM & Pipeline Management",
    subtitle: "Streamline operations & close more deals",
    description:
      "Custom CRM implementation that centralizes customer data, automates workflows, and helps your team work smarter. Integration with 50+ tools.",
    features: [
      "CRM setup & customization",
      "Pipeline & deal management",
      "Lead scoring & routing",
      "Email automation sequences",
      "Team training & onboarding",
      "Integration with existing tools",
    ],
    process: [
      { step: "01", title: "Assess", desc: "Map current sales process" },
      { step: "02", title: "Configure", desc: "Customize CRM to your needs" },
      { step: "03", title: "Automate", desc: "Build workflows & sequences" },
      { step: "04", title: "Train", desc: "Onboard team & go live" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGradient: "from-brand-orange/10 to-brand-orange-light/10",
    shadowGlow: "shadow-brand-orange/25",
    textGradient: "from-brand-orange-deep to-brand-orange",
    deliverables: ["CRM Setup", "Workflow Automation", "Training Docs", "30 Days Support"],
  },
  {
    id: "automation",
    icon: Workflow,
    title: "Business Automation",
    subtitle: "AI-powered systems that scale your business",
    description:
      "Intelligent automation systems that work 24/7. From email sequences to AI chatbots, we build systems that scale your business while reducing manual work.",
    features: [
      "Workflow automation (Zapier, Make)",
      "AI chatbot development",
      "Email marketing automation",
      "Custom dashboard & BI reports",
      "API integrations",
      "Process documentation",
    ],
    process: [
      { step: "01", title: "Identify", desc: "Find automation opportunities" },
      { step: "02", title: "Design", desc: "Map automated workflows" },
      { step: "03", title: "Build", desc: "Implement & test automation" },
      { step: "04", title: "Monitor", desc: "Track performance & optimize" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGradient: "from-charcoal/10 to-off-black/10",
    shadowGlow: "shadow-graphite/25",
    textGradient: "from-graphite to-off-black",
    deliverables: ["Automation Map", "Workflow Setup", "Dashboard Access", "Ongoing Support"],
  },
];

export default function ServicesPageClient() {
  const [activeService, setActiveService] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <main className="relative bg-background transition-colors duration-500">
      {/* <Navbar /> */}

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
        const Icon = service.icon;

        return (
          <section
            key={service.id}
            id={service.id}
            className={`relative py-20 lg:py-24 ${isEven ? "bg-background" : "bg-card"
              } transition-colors duration-500`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${!isEven ? "lg:grid-flow-dense" : ""}`}>
                {/* Content */}
                <div className={!isEven ? "lg:col-start-2" : ""}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* Icon */}
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white shadow-lg ${service.shadowGlow} mb-6`}>
                      <Icon className="w-8 h-8" />
                    </div>

                    <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-3">
                      {service.title}
                    </h2>
                    <p className="text-lg text-muted mb-2">{service.subtitle}</p>
                    <p className="text-muted leading-relaxed mb-8">{service.description}</p>

                    {/* Features */}
                    <div className="space-y-3 mb-8">
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Key Features</h4>
                      {service.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${service.gradient} flex items-center justify-center flex-shrink-0`}>
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm text-muted">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <motion.a
                      href="/contact"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r ${service.gradient} text-white font-semibold rounded-xl shadow-lg ${service.shadowGlow} group`}
                    >
                      <span>Get Started with {service.title.split("&")[0].trim()}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </motion.a>
                  </motion.div>
                </div>

                {/* Visual - Process + Deliverables */}
                <div className={!isEven ? "lg:col-start-1" : ""}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* Process */}
                    <div className={`p-6 lg:p-8 rounded-2xl bg-gradient-to-br ${service.bgGradient} border border-border`}>
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Our Process</h4>
                      <div className="space-y-4">
                        {service.process.map((step, i) => (
                          <div key={step.step} className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${service.gradient} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                              {step.step}
                            </div>
                            <div>
                              <h5 className="font-semibold text-foreground text-sm">{step.title}</h5>
                              <p className="text-sm text-muted">{step.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Deliverables */}
                    <div className="p-6 lg:p-8 rounded-2xl bg-card border border-border hover:border-accent-border transition-colors shadow-sm">
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">What You Get</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {service.deliverables.map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                            <span className="text-sm text-muted">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
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
              Book a free strategy call and we'll create a custom growth plan tailored to your business goals.
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

      {/* <Footer /> */}
    </main>
  );
}
