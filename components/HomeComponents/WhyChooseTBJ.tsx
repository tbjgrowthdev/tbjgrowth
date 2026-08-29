"use client";

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  Clock,
  Shield,
  Users,
  Target,
  BarChart3,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Star,
  Trophy,
  Heart,
  Lightbulb,
  Rocket,
  BrainCircuit,
  LineChart,
  Workflow,
  Eye,
  MessageSquare,
  ThumbsUp,
  Award,
  Timer,
  DollarSign,
  Headphones,
  RefreshCw,
  TrendingDown,
} from "lucide-react";

// Benefits data
const benefits = [
  {
    id: "proven-process",
    icon: Workflow,
    title: "Proven Growth Framework",
    description:
      "Our Build → Attract → Convert → Automate → Scale methodology isn't theory — it's a battle-tested system that's delivered 150+ successful projects.",
    stats: [
      { value: "150+", label: "Projects" },
      { value: "98%", label: "Success Rate" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGlow: "bg-brand-orange/10",
    borderGlow: "border-brand-orange/30",
    color: "orange",
  },
  {
    id: "roi-focused",
    icon: DollarSign,
    title: "ROI-First Approach",
    description:
      "Every strategy starts with your business goals. We don't just deliver pretty designs — we deliver measurable returns. Average client sees 3x ROI within 6 months.",
    stats: [
      { value: "3x", label: "Avg. ROI" },
      { value: "6mo", label: "Payback Period" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGlow: "bg-charcoal/10",
    borderGlow: "border-charcoal/30",
    color: "charcoal",
  },
  {
    id: "speed-matters",
    icon: Timer,
    title: "Speed Without Compromise",
    description:
      "We launch websites in days, not months. Our AI-assisted development and streamlined processes mean you get to market faster without sacrificing quality.",
    stats: [
      { value: "48hrs", label: "Avg. Launch" },
      { value: "99.9%", label: "Uptime" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGlow: "bg-brand-orange/10",
    borderGlow: "border-brand-orange/30",
    color: "orange",
  },
  {
    id: "ai-powered",
    icon: BrainCircuit,
    title: "AI-Powered Efficiency",
    description:
      "We leverage cutting-edge AI tools to automate repetitive tasks, analyze data faster, and deliver smarter solutions — giving you an unfair advantage.",
    stats: [
      { value: "85%", label: "Time Saved" },
      { value: "24/7", label: "Automation" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGlow: "bg-charcoal/10",
    borderGlow: "border-charcoal/30",
    color: "charcoal",
  },
  {
    id: "dedicated-support",
    icon: Headphones,
    title: "Dedicated Support Team",
    description:
      "You're not just another client. We assign a dedicated account manager who becomes an extension of your team, available when you need them.",
    stats: [
      { value: "<15min", label: "Response Time" },
      { value: "98%", label: "Satisfaction" },
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
    bgGlow: "bg-brand-orange/10",
    borderGlow: "border-brand-orange/30",
    color: "orange",
  },
  {
    id: "transparent",
    icon: Eye,
    title: "Complete Transparency",
    description:
      "No hidden fees, no black boxes. You get real-time dashboards, monthly reports, and full visibility into every campaign, every metric, every result.",
    stats: [
      { value: "100%", label: "Transparency" },
      { value: "Real-time", label: "Reporting" },
    ],
    gradient: "from-charcoal to-off-black",
    bgGlow: "bg-charcoal/10",
    borderGlow: "border-charcoal/30",
    color: "charcoal",
  },
];

// Process steps
const processSteps = [
  {
    step: "01",
    icon: Lightbulb,
    title: "Discovery & Strategy",
    description:
      "We dive deep into your business goals, audience, and competitive landscape to build a tailored growth strategy.",
    details: [
      "Business & competitor analysis",
      "Audience research & personas",
      "Goal setting & KPI definition",
      "Technology stack planning",
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
  },
  {
    step: "02",
    icon: Rocket,
    title: "Build & Launch",
    description:
      "Our team designs and develops your digital assets — websites, campaigns, automation workflows — with speed and precision.",
    details: [
      "UI/UX design & prototyping",
      "Development & integration",
      "Quality assurance & testing",
      "Deployment & go-live",
    ],
    gradient: "from-charcoal to-off-black",
  },
  {
    step: "03",
    icon: TrendingUp,
    title: "Attract & Convert",
    description:
      "We drive qualified traffic through multi-channel campaigns and optimize conversion paths to maximize results.",
    details: [
      "SEO & content marketing",
      "Paid advertising campaigns",
      "Social media management",
      "Conversion rate optimization",
    ],
    gradient: "from-brand-orange-deep to-brand-orange",
  },
  {
    step: "04",
    icon: BrainCircuit,
    title: "Automate & Scale",
    description:
      "We implement AI-powered automation and continuously optimize to scale your growth efficiently.",
    details: [
      "Workflow automation setup",
      "AI & chatbot integration",
      "Analytics & BI dashboards",
      "Continuous optimization",
    ],
    gradient: "from-charcoal to-off-black",
  },
];

// Benefit Card Component
function BenefitCard({
  benefit,
  index,
  isActive,
  onHover,
}: {
  benefit: (typeof benefits)[0];
  index: number;
  isActive: boolean;
  onHover: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  const Icon = benefit.icon;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onMouseEnter={onHover}
      className={`group relative cursor-pointer rounded-2xl p-6 transition-all duration-500 border ${
        isActive
          ? `bg-gradient-to-br ${benefit.bgGlow} ${benefit.borderGlow} shadow-2xl scale-[1.02] z-10`
          : "bg-card border-border hover:border-accent-border hover:shadow-xl"
      }`}
    >
      {/* Icon */}
      <motion.div
        animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`inline-flex p-3 rounded-xl mb-4 transition-all duration-500 ${
          isActive
            ? `bg-gradient-to-br ${benefit.gradient} text-white shadow-lg`
            : "bg-background text-muted group-hover:bg-tint"
        }`}
      >
        <Icon className="w-6 h-6" />
      </motion.div>

      {/* Title */}
      <h3 className="text-lg font-bold text-foreground mb-2">
        {benefit.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted leading-relaxed mb-4">
        {benefit.description}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-4 border-t border-border">
        {benefit.stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${benefit.gradient} bg-clip-text text-transparent`}
            >
              {stat.value}
            </div>
            <div className="text-xs text-caption">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Hover glow */}
      <div
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${benefit.bgGlow} blur-xl`}
      />
    </motion.div>
  );
}

// Process Step Component
// Process Step Component
function ProcessStep({
  step,
  index,
  isActive,
  onClick,
}: {
  step: (typeof processSteps)[0];
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;

  // Pre-compute the line color based on gradient
  const getLineColor = () => {
    if (isActive) {
      switch (step.gradient) {
        case "from-brand-orange-deep to-brand-orange":
          return "#D9500E";
        case "from-charcoal to-off-black":
          return "#1F2937";
        default:
          return "#D9500E";
      }
    }
    return "#e5e7eb";
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.15, duration: 0.5 }}
      onClick={onClick}
      className="relative flex items-start gap-4 cursor-pointer group"
    >
      {/* Timeline line */}
      <div className="relative flex flex-col items-center">
        {/* Step circle */}
        <motion.div
          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
            isActive
              ? `bg-gradient-to-br ${step.gradient} text-white shadow-lg scale-110`
              : "bg-background text-muted group-hover:bg-tint"
          }`}
        >
          <Icon className="w-5 h-5" />
        </motion.div>

        {/* Vertical line */}
        {index < processSteps.length - 1 && (
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: "100%" }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + index * 0.2, duration: 0.5 }}
            className="w-0.5 mt-2 mb-2"
            style={{
              minHeight: "40px",
              backgroundColor: getLineColor(),
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div
          className={`p-5 rounded-2xl transition-all duration-500 ${
            isActive
              ? `bg-gradient-to-br ${step.gradient} text-white shadow-lg`
              : "bg-background group-hover:bg-card"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-card text-muted"
              }`}
            >
              {step.step}
            </span>
            <h4
              className={`font-bold ${
                isActive ? "text-white" : "text-foreground"
              }`}
            >
              {step.title}
            </h4>
          </div>
          <p
            className={`text-sm leading-relaxed ${
              isActive ? "text-white/90" : "text-muted"
            }`}
          >
            {step.description}
          </p>

          {/* Expanded details */}
          <motion.div
            initial={false}
            animate={{
              height: isActive ? "auto" : 0,
              opacity: isActive ? 1 : 0,
              marginTop: isActive ? 16 : 0,
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              {step.details.map((detail, i) => (
                <motion.div
                  key={detail}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isActive ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 text-sm text-white/80"
                >
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{detail}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// Main Section
export default function WhyChooseTBJ() {
  const [activeBenefit, setActiveBenefit] = useState<number | null>(0);
  const [activeStep, setActiveStep] = useState<number>(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section
      id="why-tbj"
      ref={sectionRef}
      className="relative py-20 lg:py-28 bg-background transition-colors duration-500 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]" />

        {/* Floating orbs */}
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full blur-3xl bg-brand-orange/5"
        />
        <motion.div
          animate={{
            x: [0, -30, 40, 0],
            y: [0, 40, -20, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl bg-charcoal/5 dark:bg-white/5"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-4"
          >
            <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
            <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
              Why Businesses Choose Us
            </span>
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Why Choose{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              TBJ Growth
            </span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            We combine proven methodology, cutting-edge AI, and a relentless
            focus on ROI to deliver growth that actually matters.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-20 lg:mb-28">
          {benefits.map((benefit, index) => (
            <BenefitCard
              key={benefit.id}
              benefit={benefit}
              index={index}
              isActive={activeBenefit === index}
              onHover={() => setActiveBenefit(index)}
            />
          ))}
        </div>

        {/* Process Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {/* Process Header */}
          <div className="text-center mb-12 lg:mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-4"
            >
              <RefreshCw className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
              <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
                How We Work
              </span>
            </motion.div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
                Proven Process
              </span>
            </h3>
            <p className="text-muted max-w-xl mx-auto">
              A streamlined 4-step approach that takes your business from where
              it is to where you want it to be.
            </p>
          </div>

          {/* Process Timeline */}
          <div className="max-w-2xl mx-auto">
            {processSteps.map((step, index) => (
              <ProcessStep
                key={step.step}
                step={step}
                index={index}
                isActive={activeStep === index}
                onClick={() => setActiveStep(index)}
              />
            ))}
          </div>
        </motion.div>

        {/* Bottom Trust Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-16 lg:mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center"
        >
          {[
            { value: "150+", label: "Projects Delivered", icon: Trophy },
            { value: "50+", label: "Happy Clients", icon: Heart },
            { value: "98%", label: "Client Retention", icon: ThumbsUp },
            { value: "4.9/5", label: "Average Rating", icon: Star },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.1 }}
                whileHover={{ y: -5 }}
                className="cursor-default"
              >
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-stat rounded-xl">
                    <Icon className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light" />
                  </div>
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-caption">
                  {stat.label}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}