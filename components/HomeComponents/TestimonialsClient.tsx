"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Star,
  Quote,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  MessageSquare,
  Building2,
  Heart,
  ThumbsUp,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";

// Fallback Testimonials
const fallbackTestimonials = [
  {
    id: 1,
    quote:
      "TBJ didn't just build us a website — they built us a revenue engine. Our online sales have completely transformed since partnering with them. The ROI has been incredible.",
    author: "Sarah Mitchell",
    role: "CEO",
    company: "LuxeStyle Fashion",
    industry: "E-Commerce",
    rating: 5,
    metrics: JSON.stringify([
      { label: "Revenue Growth", value: "+320%", icon: "TrendingUp" },
      { label: "Conversion Rate", value: "4.8%", icon: "Target" },
    ]),
    gradient: "from-blue-500 to-cyan-500",
    avatar: "SM",
  },
];

// Global metrics
const globalMetrics = [
  { value: "150+", label: "Projects Delivered", icon: "Building2", suffix: "" },
  { value: "50+", label: "Happy Clients", icon: "Heart", suffix: "" },
  { value: "98", label: "Client Retention Rate", icon: "ThumbsUp", suffix: "%" },
  { value: "3", label: "Average ROI", icon: "TrendingUp", suffix: "x" },
  { value: "4.9", label: "Client Rating", icon: "Star", suffix: "/5" },
];

// Animated Counter Component
function AnimatedCounter({
  value,
  suffix,
  isInView,
}: {
  value: string;
  suffix: string;
  isInView: boolean;
}) {
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ""));
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = numericValue / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setCount(numericValue);
        clearInterval(interval);
      } else {
        setCount(current);
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [isInView, numericValue]);

  const formatValue = () => {
    if (value.includes("+")) return Math.floor(count) + "+";
    if (value.includes(".")) return count.toFixed(1);
    return Math.floor(count);
  };

  return (
    <span>
      {formatValue()}
      {suffix}
    </span>
  );
}

// Testimonial Card Component
function TestimonialCard({
  testimonial,
  isActive,
}: {
  testimonial: any;
  isActive: boolean;
}) {
  const parsedMetrics = typeof testimonial.metrics === 'string' ? JSON.parse(testimonial.metrics) : testimonial.metrics;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: isActive ? 1 : 0.3,
        scale: isActive ? 1 : 0.95,
      }}
      transition={{ duration: 0.5 }}
      className={`relative bg-white dark:bg-gray-900 rounded-3xl border transition-all duration-500 ${
        isActive
          ? `border-gray-200 dark:border-gray-700 shadow-2xl shadow-gray-200/50 dark:shadow-black/30`
          : "border-gray-100 dark:border-gray-800"
      }`}
    >
      {/* Quote icon */}
      <div className="absolute -top-4 -left-4">
        <div
          className={`p-3 rounded-2xl bg-gradient-to-br ${testimonial.gradient} text-white shadow-lg`}
        >
          <Quote className="w-6 h-6" />
        </div>
      </div>

      <div className="p-8 lg:p-10">
        {/* Stars */}
        <div className="flex items-center gap-1 mb-6">
          {[...Array(testimonial.rating || 5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={isActive ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 * i, duration: 0.3 }}
            >
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <blockquote className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-8 italic">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>

        {/* Metrics */}
        {parsedMetrics && parsedMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {parsedMetrics.map((metric: any, i: number) => {
              const Icon = getIcon(metric.icon || "Activity");
              return (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-br ${testimonial.gradient} text-white`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {metric.value}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {metric.label}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Author */}
        <div className="flex items-center gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
          {/* Avatar */}
          <div
            className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-white font-bold text-lg`}
          >
            {testimonial.avatar || testimonial.author.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-gray-900 dark:text-white">
              {testimonial.author}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {testimonial.role}, {testimonial.company}
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {testimonial.industry}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Logo Cloud Component
function LogoCloud() {
  const logos = [
    "LuxeStyle", "CloudFlow", "Thompson", "PureVibe", 
    "DigitalCraft", "TechStart", "GrowthLab", "ScaleUp",
  ];

  return (
    <div className="relative overflow-hidden">
      <motion.div
        animate={{ x: [0, -1920, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="flex gap-12 items-center"
      >
        {[...logos, ...logos].map((logo, i) => (
          <div
            key={i}
            className="flex-shrink-0 px-8 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 font-bold text-lg tracking-wide"
          >
            {logo}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// Main Section
export default function TestimonialsClient({ dbTestimonials }: { dbTestimonials?: any[] }) {
  const testimonialsList = dbTestimonials && dbTestimonials.length > 0 ? dbTestimonials : fallbackTestimonials;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);
  const isMetricsInView = useInView(metricsRef, { once: true, amount: 0.5 });

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonialsList.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, testimonialsList.length]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + testimonialsList.length) % testimonialsList.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % testimonialsList.length);
  };

  return (
    <section
      id="testimonials"
      ref={sectionRef}
      className="relative py-20 lg:py-28 bg-gray-50 dark:bg-gray-900 transition-colors duration-500 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_30%,transparent_100%)]" />
        
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl bg-blue-500/5"
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
            <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Client Success Stories
            </span>
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Trusted by{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Growing Businesses
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what our clients say about
            working with TBJ Growth.
          </p>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-4xl mx-auto mb-16 lg:mb-20">
          {/* Main testimonial */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <TestimonialCard
                key={testimonialsList[activeIndex].id}
                testimonial={testimonialsList[activeIndex]}
                isActive={true}
              />
            </AnimatePresence>

            {/* Navigation arrows */}
            <button
              onClick={handlePrev}
              className="absolute left-0 top-1/2 -translate-x-4 lg:-translate-x-6 -translate-y-1/2 p-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all z-10 group"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 translate-x-4 lg:translate-x-6 -translate-y-1/2 p-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all z-10 group"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Dots & Auto-play */}
          <div className="flex items-center justify-center gap-3 mt-8">
            {testimonialsList.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveIndex(index);
                  setIsAutoPlaying(false);
                }}
                className={`transition-all duration-300 rounded-full ${
                  index === activeIndex
                    ? `w-8 h-2.5 bg-gradient-to-r ${testimonialsList[index].gradient}`
                    : "w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                }`}
              />
            ))}
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="ml-2 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {isAutoPlaying ? (
                <Pause className="w-4 h-4 text-gray-400" />
              ) : (
                <Play className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Logo Cloud */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mb-16 lg:mb-20"
        >
          <p className="text-center text-sm text-gray-500 dark:text-gray-500 mb-6 uppercase tracking-wider">
            Trusted by innovative companies
          </p>
          <LogoCloud />
        </motion.div>

        {/* Global Metrics */}
        <motion.div
          ref={metricsRef}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6"
        >
          {globalMetrics.map((metric, i) => {
            const Icon = getIcon(metric.icon);
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.1 }}
                whileHover={{ y: -5 }}
                className="relative group cursor-default"
              >
                <div className="text-center p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <div className="flex justify-center mb-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                    <AnimatedCounter
                      value={metric.value}
                      suffix={metric.suffix}
                      isInView={isMetricsInView}
                    />
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    {metric.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="text-center mt-16 lg:mt-20"
        >
          <div className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <span className="text-sm">
              Join 50+ businesses already growing with TBJ
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
