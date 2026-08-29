"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import {
  CheckCircle2,
  Wrench,
  TrendingUp,
  Target,
  Bot,
  Rocket,
  Monitor,
  Search,
  Users,
  BarChart3,
  Workflow,
  Zap,
  Globe,
  Smartphone,
  Palette,
  MousePointerClick,
  LineChart,
  Mail,
  MessageSquare,
  BrainCircuit,
  Network,
  Shield,
  Eye,
  ArrowUpRight,
  Layers,
  Settings,
  Activity,
} from "lucide-react";

// Stage definitions with their content
const stages = [
  {
    id: "build",
    label: "Build",
    icon: Wrench,
    color: "from-brand-orange-deep to-brand-orange",
    glowColor: "shadow-brand-orange/30",
    bgGradient: "from-brand-orange/10 to-brand-orange/5",
    description: "We design and build your digital foundation — websites, brands, and user experiences that convert.",
    dashboardItems: [
      { icon: Monitor, label: "Website Design", value: "Responsive & Fast" },
      { icon: Palette, label: "Brand Identity", value: "Cohesive & Memorable" },
      { icon: Layers, label: "UX Architecture", value: "User-Centered" },
      { icon: Smartphone, label: "Mobile-First", value: "All Devices" },
    ],
    metrics: { primary: "48hrs", secondary: "Avg. Launch Time" },
  },
  {
    id: "attract",
    label: "Attract",
    icon: TrendingUp,
    color: "from-charcoal to-off-black",
    glowColor: "shadow-charcoal/30",
    bgGradient: "from-charcoal/10 to-off-black/5",
    description: "Drive targeted traffic through SEO, paid ads, and social media strategies that bring qualified leads.",
    dashboardItems: [
      { icon: Search, label: "SEO Strategy", value: "Top 3 Rankings" },
      { icon: Globe, label: "Paid Ads", value: "ROAS 4.5x" },
      { icon: Users, label: "Social Media", value: "2.5M+ Reach" },
      { icon: Eye, label: "Content Marketing", value: "10k+ Visitors" },
    ],
    metrics: { primary: "+245%", secondary: "Traffic Increase" },
  },
  {
    id: "convert",
    label: "Convert",
    icon: Target,
    color: "from-brand-orange-deep to-brand-orange",
    glowColor: "shadow-brand-orange/30",
    bgGradient: "from-brand-orange/10 to-brand-orange/5",
    description: "Turn visitors into customers with high-converting landing pages, CRM integration, and smart lead capture.",
    dashboardItems: [
      { icon: MousePointerClick, label: "Landing Pages", value: "4.2% Conv. Rate" },
      { icon: BarChart3, label: "CRM Setup", value: "Automated Pipeline" },
      { icon: Mail, label: "Lead Capture", value: "500+ Leads/mo" },
      { icon: Activity, label: "A/B Testing", value: "Continuous Opt." },
    ],
    metrics: { primary: "+180%", secondary: "Lead Growth" },
  },
  {
    id: "automate",
    label: "Automate",
    icon: Bot,
    color: "from-charcoal to-off-black",
    glowColor: "shadow-charcoal/30",
    bgGradient: "from-charcoal/10 to-off-black/5",
    description: "Set your growth on autopilot with AI workflows, email automation, and intelligent chatbots that work 24/7.",
    dashboardItems: [
      { icon: BrainCircuit, label: "AI Workflows", value: "Smart Automation" },
      { icon: MessageSquare, label: "Chatbot", value: "24/7 Support" },
      { icon: Workflow, label: "Email Sequences", value: "42% Open Rate" },
      { icon: Network, label: "Integration", value: "50+ Tools" },
    ],
    metrics: { primary: "85%", secondary: "Time Saved" },
  },
  {
    id: "scale",
    label: "Scale",
    icon: Rocket,
    color: "from-brand-orange-deep to-brand-orange",
    glowColor: "shadow-brand-orange/30",
    bgGradient: "from-brand-orange/10 to-brand-orange/5",
    description: "Scale intelligently with advanced analytics, business intelligence, and AI-driven growth strategies.",
    dashboardItems: [
      { icon: LineChart, label: "Analytics Suite", value: "Real-time Data" },
      { icon: Shield, label: "BI Reports", value: "Monthly Insights" },
      { icon: Settings, label: "Growth Strategy", value: "Custom Roadmap" },
      { icon: Zap, label: "Performance", value: "99.9% Uptime" },
    ],
    metrics: { primary: "+320%", secondary: "Revenue Growth" },
  },
];

export default function BusinessJourney() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const isInView = useInView(sectionRef, { amount: 0.3 });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const dashboardY = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const dashboardRotateX = useTransform(scrollYProgress, [0, 1], [5, -5]);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Mouse parallax for dashboard
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dashboardRef.current) {
      const rect = dashboardRef.current.getBoundingClientRect();
      setMousePosition({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 15,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 15,
      });
    }
  };

  // Auto-advance stages
  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isInView]);

  const currentStage = stages[activeStage];
  const StageIcon = currentStage.icon;

  return (
    <section
      id="business-journey"
      ref={sectionRef}
      className="relative min-h-screen bg-background py-20 lg:py-28 overflow-hidden transition-colors duration-500"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)]" />
        
        {/* Animated gradient orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br ${currentStage.bgGradient}`}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className={`absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl bg-gradient-to-br ${currentStage.bgGradient}`}
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
              Business Journey
            </span>
          </h2>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            From foundation to scale — a proven framework that transforms your
            digital presence into a growth engine.
          </p>
        </motion.div>

        {/* Pipeline / Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative mb-16 lg:mb-24"
        >
          {/* Background Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 rounded-full" />
          
          {/* Active Progress Line */}
          <motion.div
            className="hidden lg:block absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-brand-orange-deep via-brand-orange to-brand-orange-light -translate-y-1/2 rounded-full"
            style={{ width: `${((activeStage + 1) / stages.length) * 100}%` }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />

          {/* Stage Buttons */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-0">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const isActive = index === activeStage;
              const isCompleted = index < activeStage;

              return (
                <motion.button
                  key={stage.id}
                  onClick={() => setActiveStage(index)}
                  className={`relative z-10 flex items-center gap-3 lg:flex-col lg:gap-2 px-6 py-4 lg:py-3 rounded-2xl transition-all duration-500 cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r " + stage.color + " text-white shadow-2xl " + stage.glowColor + " scale-105 lg:scale-110"
                      : isCompleted
                      ? "bg-card text-foreground"
                      : "bg-background text-caption hover:bg-card"
                  }`}
                  whileHover={{ scale: isActive ? 1.1 : 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`p-2 rounded-xl ${
                      isActive
                        ? "bg-white/20"
                        : isCompleted
                        ? "bg-gradient-to-r " + stage.color + " text-white"
                        : "bg-card"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </motion.div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${
                    isActive ? "text-white" : ""
                  }`}>
                    {stage.label}
                  </span>

                  {/* Connection dot on mobile */}
                  {index < stages.length - 1 && (
                    <div className="lg:hidden w-0.5 h-6 bg-border mx-auto" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Interactive Dashboard */}
        <motion.div
          ref={dashboardRef}
          onMouseMove={handleMouseMove}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.7 }}
          style={{
            y: dashboardY,
            rotateX: dashboardRotateX,
            transformStyle: "preserve-3d",
          }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Dashboard Container */}
          <div className="relative bg-card rounded-3xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-border overflow-hidden">
            {/* Dashboard inner gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${currentStage.bgGradient} opacity-50 dark:opacity-30`} />

            {/* Dashboard Content */}
            <div className="relative p-6 lg:p-8">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <span className="text-sm text-caption ml-2">
                    tbj-growth-dashboard
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-caption">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live
                </div>
              </div>

              {/* Dashboard Body */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStage.id}
                  initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    x: mousePosition.x,
                    y: mousePosition.y,
                  }}
                >
                  {/* Stage Title & Description */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6 mb-8">
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${currentStage.color} text-white shadow-lg ${currentStage.glowColor}`}
                    >
                      <StageIcon className="w-8 h-8" />
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                        {currentStage.label} Phase
                      </h3>
                      <p className="text-muted">
                        {currentStage.description}
                      </p>
                    </div>
                    {/* Metric Card */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="flex-shrink-0 bg-stat rounded-2xl p-6 text-center border border-border"
                    >
                      <div className={`text-3xl font-bold bg-gradient-to-r ${currentStage.color} bg-clip-text text-transparent`}>
                        {currentStage.metrics.primary}
                      </div>
                      <div className="text-sm text-caption mt-1">
                        {currentStage.metrics.secondary}
                      </div>
                    </motion.div>
                  </div>

                  {/* Dashboard Grid Items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {currentStage.dashboardItems.map((item, index) => {
                      const ItemIcon = item.icon;
                      return (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index, duration: 0.4 }}
                          className="group relative bg-card/80 backdrop-blur-sm rounded-2xl p-5 border border-border hover:border-accent-border transition-all duration-300 cursor-pointer"
                          whileHover={{ y: -4, scale: 1.02 }}
                        >
                          <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${currentStage.bgGradient} mb-3 group-hover:scale-110 transition-transform duration-300`}>
                            <ItemIcon className={`w-5 h-5 text-muted`} />
                          </div>
                          <div className="text-sm font-semibold text-foreground mb-1">
                            {item.label}
                          </div>
                          <div className="text-xs text-caption flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                            {item.value}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Bottom Progress Indicator */}
                  <div className="mt-8 flex items-center gap-2">
                    {stages.map((stage, index) => (
                      <motion.div
                        key={stage.id}
                        className={`h-1 rounded-full transition-all duration-500 ${
                          index === activeStage
                            ? `bg-gradient-to-r ${currentStage.color} flex-1`
                            : index < activeStage
                            ? "bg-brand-orange w-8"
                            : "bg-border w-8"
                        }`}
                        animate={
                          index === activeStage
                            ? { scaleX: [0.8, 1, 0.8] }
                            : {}
                        }
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Floating Elements */}
          <motion.div
            animate={{
              y: [0, -15, 0],
              rotate: [0, 5, 0],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 -right-6 lg:-top-8 lg:-right-8 bg-card rounded-xl shadow-lg border border-border p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-brand-orange-deep to-brand-orange rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Live</div>
              <div className="text-xs text-caption">Processing</div>
            </div>
          </motion.div>

          <motion.div
            animate={{
              y: [0, 10, 0],
              rotate: [0, -3, 0],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -bottom-4 -left-6 lg:-bottom-6 lg:-left-8 bg-card rounded-xl shadow-lg border border-border p-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-charcoal to-off-black rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Growth</div>
              <div className="text-xs text-caption">+{activeStage * 60 + 45}%</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}