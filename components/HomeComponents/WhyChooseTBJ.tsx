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
    gradient: "from-blue-500 to-cyan-500",
    bgGlow: "bg-blue-500/10",
    borderGlow: "border-blue-500/30",
    color: "blue",
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
    gradient: "from-green-500 to-emerald-500",
    bgGlow: "bg-green-500/10",
    borderGlow: "border-green-500/30",
    color: "green",
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
    gradient: "from-orange-500 to-red-500",
    bgGlow: "bg-orange-500/10",
    borderGlow: "border-orange-500/30",
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
    gradient: "from-purple-500 to-pink-500",
    bgGlow: "bg-purple-500/10",
    borderGlow: "border-purple-500/30",
    color: "purple",
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
    gradient: "from-indigo-500 to-blue-600",
    bgGlow: "bg-indigo-500/10",
    borderGlow: "border-indigo-500/30",
    color: "indigo",
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
    gradient: "from-violet-500 to-purple-600",
    bgGlow: "bg-violet-500/10",
    borderGlow: "border-violet-500/30",
    color: "violet",
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
    gradient: "from-blue-500 to-cyan-500",
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
    gradient: "from-purple-500 to-pink-500",
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
    gradient: "from-orange-500 to-red-500",
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
    gradient: "from-green-500 to-emerald-500",
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
          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl"
      }`}
    >
      {/* Icon */}
      <motion.div
        animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className={`inline-flex p-3 rounded-xl mb-4 transition-all duration-500 ${
          isActive
            ? `bg-gradient-to-br ${benefit.gradient} text-white shadow-lg`
            : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-750"
        }`}
      >
        <Icon className="w-6 h-6" />
      </motion.div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
        {benefit.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
        {benefit.description}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        {benefit.stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className={`text-xl font-bold bg-gradient-to-r ${benefit.gradient} bg-clip-text text-transparent`}
            >
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
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
        case "from-blue-500 to-cyan-500":
          return "#3b82f6";
        case "from-purple-500 to-pink-500":
          return "#a855f7";
        case "from-orange-500 to-red-500":
          return "#f97316";
        case "from-green-500 to-emerald-500":
          return "#22c55e";
        default:
          return "#6366f1";
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
              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
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
              : "bg-gray-50 dark:bg-gray-800/50 group-hover:bg-gray-100 dark:group-hover:bg-gray-800"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              {step.step}
            </span>
            <h4
              className={`font-bold ${
                isActive ? "text-white" : "text-gray-900 dark:text-white"
              }`}
            >
              {step.title}
            </h4>
          </div>
          <p
            className={`text-sm leading-relaxed ${
              isActive ? "text-white/90" : "text-gray-600 dark:text-gray-400"
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
      className="relative py-20 lg:py-28 bg-white dark:bg-gray-950 transition-colors duration-500 overflow-hidden"
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
          className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full blur-3xl bg-blue-500/5"
        />
        <motion.div
          animate={{
            x: [0, -30, 40, 0],
            y: [0, 40, -20, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl bg-purple-500/5"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-4"
          >
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Why Businesses Choose Us
            </span>
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Why Choose{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              TBJ Growth
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-4"
            >
              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                How We Work
              </span>
            </motion.div>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Proven Process
              </span>
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
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
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-xl">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
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