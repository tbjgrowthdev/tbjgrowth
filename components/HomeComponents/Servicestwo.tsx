"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  Globe,
  Search,
  Share2,
  Megaphone,
  Settings,
  Workflow,
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
  ArrowRight,
  Sparkles,
  Hexagon,
  BarChart3,
  LineChart,
  MousePointerClick,
  Activity,
  Network,
  BrainCircuit,
  Eye,
  Layers,
  Cpu,
} from "lucide-react";

// Service definitions with circular position calculated automatically
const servicesData = [
  {
    id: "web-dev",
    icon: Globe,
    title: "Website Development",
    subtitle: "Conversion-Focused Design",
    description: "Custom-built, high-performance websites that turn visitors into customers. Every pixel engineered for speed, accessibility, and conversion.",
    benefits: [
      "98+ PageSpeed Score",
      "Mobile-First Architecture",
      "SEO-Optimized Structure",
      "Conversion Rate Optimization",
    ],
    gradient: "from-blue-500 to-cyan-500",
    bgGlow: "bg-blue-500/20",
    borderGlow: "border-blue-500/30",
    shadowGlow: "shadow-blue-500/25",
    textGradient: "from-blue-400 to-cyan-400",
    preview: "dashboard",
    stat: "98%",
    statLabel: "Performance Score",
    previewIcons: [Monitor, Smartphone, Palette, Code2],
  },
  {
    id: "seo",
    icon: Search,
    title: "SEO & Content Strategy",
    subtitle: "Dominate Search Rankings",
    description: "Data-driven SEO strategies that put you at the top of Google. From technical optimization to content that ranks and converts.",
    benefits: [
      "Top 3 Keyword Rankings",
      "Organic Traffic Growth",
      "Content That Converts",
      "Monthly Performance Reports",
    ],
    gradient: "from-indigo-500 to-blue-600",
    bgGlow: "bg-indigo-500/20",
    borderGlow: "border-indigo-500/30",
    shadowGlow: "shadow-indigo-500/25",
    textGradient: "from-indigo-400 to-blue-400",
    preview: "analytics",
    stat: "+245%",
    statLabel: "Organic Traffic",
    previewIcons: [Search, TrendingUp, LineChart, Eye],
  },
  {
    id: "smm",
    icon: Share2,
    title: "Social Media Marketing",
    subtitle: "Build Your Community",
    description: "Strategic social media management that builds engaged communities and drives measurable business results across all platforms.",
    benefits: [
      "2.5M+ Monthly Reach",
      "Community Growth Strategy",
      "Content That Engages",
      "Paid & Organic Mix",
    ],
    gradient: "from-purple-500 to-pink-500",
    bgGlow: "bg-purple-500/20",
    borderGlow: "border-purple-500/30",
    shadowGlow: "shadow-purple-500/25",
    textGradient: "from-purple-400 to-pink-400",
    preview: "social",
    stat: "2.5M+",
    statLabel: "Monthly Reach",
    previewIcons: [Users, Share2, MessageSquare, Activity],
  },
  {
    id: "ads",
    icon: Megaphone,
    title: "Google & Meta Ads",
    subtitle: "ROI-Driven Campaigns",
    description: "High-performing paid campaigns managed by certified specialists. Every pound tracked, optimized, and maximized for ROI.",
    benefits: [
      "4.5x Average ROAS",
      "Advanced Audience Targeting",
      "A/B Testing & Optimization",
      "Transparent Reporting",
    ],
    gradient: "from-orange-500 to-red-500",
    bgGlow: "bg-orange-500/20",
    borderGlow: "border-orange-500/30",
    shadowGlow: "shadow-orange-500/25",
    textGradient: "from-orange-400 to-red-400",
    preview: "ads",
    stat: "4.5x",
    statLabel: "Average ROAS",
    previewIcons: [Target, MousePointerClick, BarChart3, TrendingUp],
  },
  {
    id: "crm",
    icon: Settings,
    title: "CRM Solutions",
    subtitle: "Streamline Operations",
    description: "Custom CRM implementation that centralizes your customer data, automates workflows, and helps your team work smarter.",
    benefits: [
      "Automated Lead Management",
      "Custom Pipeline Setup",
      "Team Collaboration Tools",
      "Integration With 50+ Tools",
    ],
    gradient: "from-green-500 to-emerald-500",
    bgGlow: "bg-green-500/20",
    borderGlow: "border-green-500/30",
    shadowGlow: "shadow-green-500/25",
    textGradient: "from-green-400 to-emerald-400",
    preview: "crm",
    stat: "85%",
    statLabel: "Efficiency Gain",
    previewIcons: [Users, Mail, Network, Settings],
  },
  {
    id: "automation",
    icon: Workflow,
    title: "Business Automation",
    subtitle: "Scale With AI",
    description: "Intelligent automation systems that work 24/7. From email sequences to AI chatbots, we build systems that scale your business.",
    benefits: [
      "AI-Powered Workflows",
      "24/7 Chatbot Support",
      "Email Automation",
      "Smart Analytics & BI",
    ],
    gradient: "from-violet-500 to-purple-600",
    bgGlow: "bg-violet-500/20",
    borderGlow: "border-violet-500/30",
    shadowGlow: "shadow-violet-500/25",
    textGradient: "from-violet-400 to-purple-400",
    preview: "automation",
    stat: "24/7",
    statLabel: "Automated Operations",
    previewIcons: [BrainCircuit, Zap, Cpu, Workflow],
  },
];

// Calculate positions on a perfect circle
const radius = 42; // percentage from center
const totalServices = servicesData.length;
const services = servicesData.map((service, index) => {
  // Start from top (-90 degrees) and go clockwise
  const angle = (index / totalServices) * 2 * Math.PI - Math.PI / 2;
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);
  return {
    ...service,
    position: { x, y },
  };
});

type PositionedService = (typeof services)[number];

// Preview mockups
const previewMockups = {
  dashboard: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full bg-red-400" />
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <div className="w-2 h-2 rounded-full bg-green-400" />
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {[35, 55, 40, 75, 50, 85, 60, 90, 45, 70, 55, 80].map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: i * 0.03, duration: 0.4 }}
            className="flex-1 bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-sm opacity-70"
          />
        ))}
      </div>
    </div>
  ),
  analytics: () => (
    <div className="space-y-3">
      <div className="h-16 relative">
        <svg className="w-full h-full" viewBox="0 0 200 60">
          <motion.path
            d="M0,50 C20,40 40,20 60,30 C80,40 100,10 120,25 C140,40 160,15 180,20 L200,10"
            fill="none"
            stroke="url(#analyticsGradient)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="analyticsGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  ),
  social: () => (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="aspect-square rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center"
        >
          <Users className="w-4 h-4 text-purple-400" />
        </motion.div>
      ))}
    </div>
  ),
  ads: () => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "85%" }}
            transition={{ duration: 1, delay: 0.2 }}
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
          />
        </div>
        <span className="text-xs font-bold text-orange-500">85%</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "92%" }}
            transition={{ duration: 1, delay: 0.4 }}
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
          />
        </div>
        <span className="text-xs font-bold text-orange-500">92%</span>
      </div>
    </div>
  ),
  crm: () => (
    <div className="space-y-2">
      {["Lead Captured", "Email Sent", "Meeting Booked", "Deal Closed"].map((item, i) => (
        <motion.div
          key={item}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-center gap-2 text-xs"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-gray-600 dark:text-gray-400">{item}</span>
          <span className="ml-auto text-gray-400 dark:text-gray-500">2min ago</span>
        </motion.div>
      ))}
    </div>
  ),
  automation: () => (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.15 }}
          className="flex items-center gap-2"
        >
          <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <BrainCircuit className="w-3 h-3 text-violet-400" />
          </div>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${i * 30}%` }}
              transition={{ duration: 0.8, delay: i * 0.2 }}
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
            />
          </div>
          <Zap className="w-3 h-3 text-violet-400" />
        </motion.div>
      ))}
    </div>
  ),
};

// Service Node Component
function ServiceNode({
  service,
  index,
  isActive,
  onHover,
}: {
  service: (typeof services)[0];
  index: number;
  isActive: boolean;
  onHover: () => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const Icon = service.icon;

  // Magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set((e.clientX - centerX) * 0.4);
      y.set((e.clientY - centerY) * 0.4);
    }
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={nodeRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={onHover}
      style={{
        x: springX,
        y: springY,
        left: `${service.position.x}%`,
        top: `${service.position.y}%`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: isActive ? 1.2 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        delay: index * 0.1,
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10`}
    >
      {/* Glow ring */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
          opacity: isActive ? [0.5, 0.8, 0.5] : 0,
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`absolute -inset-2 rounded-full ${service.bgGlow} blur-md`}
      />

      {/* Outer ring */}
      <div
        className={`absolute -inset-1 rounded-full border-2 transition-all duration-500 ${
          isActive
            ? `${service.borderGlow} opacity-100`
            : "border-gray-300 dark:border-gray-600 opacity-40"
        }`}
      />

      {/* Main card */}
      <div
        className={`relative w-16 h-16 lg:w-20 lg:h-20 rounded-full flex flex-col items-center justify-center gap-0.5 backdrop-blur-xl transition-all duration-500 ${
          isActive
            ? `bg-white dark:bg-gray-800 shadow-2xl ${service.shadowGlow}`
            : "bg-white/80 dark:bg-gray-800/80 shadow-lg hover:shadow-xl"
        }`}
      >
        {/* Glass reflection */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 to-transparent pointer-events-none" />

        <Icon
          className={`w-5 h-5 lg:w-6 lg:h-6 transition-all duration-500 ${
            isActive
              ? `text-transparent bg-clip-text bg-gradient-to-br ${service.gradient}`
              : "text-gray-500 dark:text-gray-400"
          }`}
        />
        <span
          className={`text-[8px] lg:text-[10px] font-semibold text-center leading-tight px-1 transition-colors duration-500 ${
            isActive
              ? "text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {service.title.split(" ")[0]}
        </span>
      </div>
    </motion.div>
  );
}

// Connection Lines Component - Always visible and animated
function ConnectionLines({
  services,
  activeIndex,
}: {
  services: PositionedService[];
  activeIndex: number;
}) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <defs>
        {/* Gradient for each service line */}
        {services.map((service, index) => (
          <linearGradient
            key={service.id}
            id={`line-gradient-${service.id}`}
            x1="50%"
            y1="50%"
            x2={`${service.position.x}%`}
            y2={`${service.position.y}%`}
          >
            <stop
              offset="0%"
              stopColor={index === activeIndex ? "#6366f1" : "#94a3b8"}
              stopOpacity={index === activeIndex ? 1 : 0.3}
            />
            <stop
              offset="100%"
              stopColor={
                index === activeIndex
                  ? service.gradient.split(" ")[1].replace("from-", "").replace("to-", "")
                  : "#cbd5e1"
              }
              stopOpacity={index === activeIndex ? 1 : 0.3}
            />
          </linearGradient>
        ))}
      </defs>

      {/* Outer circle ring */}
      <motion.circle
        cx="50%"
        cy="50%"
        r="42%"
        fill="none"
        stroke="url(#circleGradient)"
        strokeWidth="0.5"
        strokeDasharray="4 8"
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: 0.4, rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="dark:opacity-30"
      />
      <defs>
        <linearGradient id="circleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* Connection lines from center to each service */}
      {services.map((service, index) => (
        <g key={service.id}>
          {/* Main line */}
          <motion.line
            x1="50%"
            y1="50%"
            x2={`${service.position.x}%`}
            y2={`${service.position.y}%`}
            stroke={`url(#line-gradient-${service.id})`}
            strokeWidth={index === activeIndex ? 2.5 : 1.5}
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: 1,
            }}
            transition={{ duration: 1.5, delay: index * 0.2, ease: "easeInOut" }}
          />

          {/* Animated dot traveling along the line */}
          <motion.circle
            r={index === activeIndex ? 4 : 2.5}
            fill={index === activeIndex ? "#6366f1" : "#94a3b8"}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: index * 0.5,
              ease: "easeInOut",
            }}
          >
            <animateMotion
              dur={`${3 + index * 0.5}s`}
              repeatCount="indefinite"
              path={`M50,50 L${service.position.x},${service.position.y}`}
            />
          </motion.circle>
        </g>
      ))}
    </svg>
  );
}

// Featured Panel Component
function FeaturedPanel({
  service,
}: {
  service: (typeof services)[0] | null;
}) {
  if (!service) return null;

  const PreviewComponent = previewMockups[service.preview as keyof typeof previewMockups];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={service.id}
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="relative"
      >
        {/* Main card */}
        <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-gray-300/20 dark:shadow-black/40 border border-gray-200 dark:border-gray-800 overflow-hidden">
          {/* Gradient overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-5 dark:opacity-10`}
          />

          <div className="relative p-8">
            {/* Service icon */}
            <motion.div
              initial={{ rotate: -10, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white shadow-lg ${service.shadowGlow} mb-6`}
            >
              <service.icon className="w-8 h-8" />
            </motion.div>

            {/* Title & description */}
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {service.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {service.subtitle}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              {service.description}
            </p>

            {/* Preview mockup */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-200 dark:border-gray-700"
            >
              <PreviewComponent />
            </motion.div>

            {/* Benefits list */}
            <div className="space-y-3 mb-6">
              {service.benefits.map((benefit, i) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-gradient-to-br ${service.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {benefit}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Stat & CTA */}
            <div className="flex items-center justify-between">
              <div>
                <div
                  className={`text-3xl font-bold bg-gradient-to-r ${service.gradient} bg-clip-text text-transparent`}
                >
                  {service.stat}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {service.statLabel}
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-3 bg-gradient-to-r ${service.gradient} text-white font-semibold rounded-xl shadow-lg ${service.shadowGlow} flex items-center gap-2 group`}
              >
                <span>Learn More</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Main Services Section
export default function Services() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeService, setActiveService] = useState<number>(0);

  const [particles] = useState(() =>
    Array.from({ length: 20 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 3,
    }))
  );

  return (
    <section
      id="services"
      ref={sectionRef}
      className="relative py-20 lg:py-28 bg-white dark:bg-gray-950 transition-colors duration-500 overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_100%)]" />

        {/* Floating orbs */}
        <motion.div
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -40, 20, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl bg-blue-500/5"
        />
        <motion.div
          animate={{
            x: [0, -20, 30, 0],
            y: [0, 30, -20, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full blur-3xl bg-purple-500/5"
        />

        {/* Floating particles */}
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-blue-400/20 dark:bg-blue-400/10"
            style={{
              left: particle.left,
              top: particle.top,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
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
              Our Services Ecosystem
            </span>
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Complete{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Growth Solutions
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Hover over any service to explore. Everything you need to build,
            attract, convert, automate, and scale — working together as one
            seamless ecosystem.
          </p>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left - Interactive Ecosystem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative aspect-square lg:aspect-auto lg:h-[550px]"
          >
            {/* Always visible connection lines */}
            <ConnectionLines services={services} activeIndex={activeService} />

            {/* Center node */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
              animate={{
                scale: [1, 1.08, 1],
                rotate: [0, 360],
              }}
              transition={{
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 30, repeat: Infinity, ease: "linear" },
              }}
            >
              <div className="relative">
                {/* Outer rotating ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-3 rounded-full border border-blue-400/30 dark:border-blue-400/20"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-6 rounded-full border border-purple-400/20 dark:border-purple-400/10 border-dashed"
                />

                {/* Outer glow */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-500/40 blur-2xl scale-150 animate-pulse" />

                {/* Center card */}
                <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex flex-col items-center justify-center shadow-2xl shadow-purple-500/30 border-2 border-white/20">
                  <Hexagon className="w-8 h-8 lg:w-10 lg:h-10 text-white mb-0.5" />
                  <span className="text-[10px] lg:text-xs font-bold text-white text-center leading-tight">
                    Your
                    <br />
                    Business
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Service nodes in perfect circle */}
            {services.map((service, index) => (
              <ServiceNode
                key={service.id}
                service={service}
                index={index}
                isActive={activeService === index}
                onHover={() => setActiveService(index)}
              />
            ))}
          </motion.div>

          {/* Right - Featured Panel */}
          <div className="relative">
            <FeaturedPanel service={services[activeService]} />
          </div>
        </div>
      </div>
    </section>
  );
}