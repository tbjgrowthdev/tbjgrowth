"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Play,
  Zap,
  TrendingUp,
  Building2,
  Sparkles,
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
} from "lucide-react";

type SiteSettings = {
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
} | null;

export default function Hero({ settings }: { settings?: SiteSettings } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 100]);

  // Parallax mouse effect
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePosition({
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
      });
    }
  };

  // Animated background orbs
  const floatingOrbs = [
    {
      color: "bg-brand-orange/20 dark:bg-brand-orange/30",
      size: "w-72 h-72 md:w-96 md:h-96",
      initialX: "0%",
      initialY: "0%",
      animateX: ["0%", "10%", "-5%", "0%"],
      animateY: ["0%", "-10%", "5%", "0%"],
      duration: 20,
    },
    {
      color: "bg-charcoal/20 dark:bg-white/10",
      size: "w-64 h-64 md:w-80 md:h-80",
      initialX: "100%",
      initialY: "50%",
      animateX: ["0%", "-5%", "10%", "0%"],
      animateY: ["0%", "10%", "-5%", "0%"],
      duration: 25,
    },
    {
      color: "bg-brand-orange-light/15 dark:bg-brand-orange-light/25",
      size: "w-56 h-56 md:w-72 md:h-72",
      initialX: "50%",
      initialY: "100%",
      animateX: ["0%", "10%", "-10%", "0%"],
      animateY: ["0%", "-15%", "5%", "0%"],
      duration: 18,
    },
  ];

  const socialLinks = [
    { icon: Linkedin, href: settings?.linkedinUrl, label: "LinkedIn" },
    { icon: Twitter, href: settings?.twitterUrl, label: "Twitter" },
    { icon: Instagram, href: settings?.instagramUrl, label: "Instagram" },
    { icon: Facebook, href: settings?.facebookUrl, label: "Facebook" },
  ].filter((social): social is typeof social & { href: string } => Boolean(social.href));

  // Trust badges with counting animation
  const stats = [
    { value: "150+", label: "Projects Delivered", icon: Building2 },
    { value: "98%", label: "Client Retention", icon: TrendingUp },
    { value: "3x", label: "Avg. ROI", icon: Zap },
  ];

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background transition-colors duration-500"
    >
      {/* Floating Background Orbs */}
      {floatingOrbs.map((orb, index) => (
        <motion.div
          key={index}
          className={`absolute ${orb.size} rounded-full blur-3xl ${orb.color} pointer-events-none`}
          style={{
            left: orb.initialX,
            top: orb.initialY,
            x: mousePosition.x * (index + 1) * 0.3,
            y: mousePosition.y * (index + 1) * 0.3,
          }}
          animate={{
            x: isHovering
              ? mousePosition.x * (index + 1) * 0.3
              : orb.animateX.map((x) => x),
            y: isHovering
              ? mousePosition.y * (index + 1) * 0.3
              : orb.animateY.map((y) => y),
          }}
          transition={{
            x: {
              duration: isHovering ? 0.5 : orb.duration,
              repeat: isHovering ? 0 : Infinity,
              ease: "linear",
            },
            y: {
              duration: isHovering ? 0.5 : orb.duration * 0.8,
              repeat: isHovering ? 0 : Infinity,
              ease: "linear",
            },
          }}
        />
      ))}

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <motion.div
        style={{ opacity, scale, y }}
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-32 pb-16"
      >
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-6"
            >
              <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
              <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
                AI-Powered Growth Agency
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-foreground tracking-tight leading-[1.1] mb-6"
            >
              We{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep via-brand-orange to-brand-orange-light animate-gradient">
                Build, Attract
              </span>{" "}
              & Scale Your Digital Presence
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg sm:text-xl text-muted leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
            >
              From strategy to automation, we help UK businesses grow with
              design that converts, marketing that attracts, and AI that scales.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12"
            >
              {/* Primary CTA */}
              <motion.a
                href="#contact"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-semibold rounded-2xl overflow-hidden shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/30 transition-shadow duration-300"
              >
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                <span className="relative z-10">Start Your Growth Journey</span>
                <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>

              {/* Secondary CTA */}
              <motion.a
                href="#case-studies"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-border text-muted font-semibold rounded-2xl hover:border-brand-orange hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                <span>View Our Work</span>
              </motion.a>
            </motion.div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="flex items-center justify-center lg:justify-start gap-3 mb-12"
              >
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <motion.a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="p-2.5 rounded-xl bg-background text-muted hover:bg-gradient-to-br hover:from-brand-orange-deep hover:to-brand-orange hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                      aria-label={social.label}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.a>
                  );
                })}
              </motion.div>
            )}

            {/* Funnel Steps Preview */}
            {/* <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="hidden lg:block"
            >
              <p className="text-sm font-medium text-caption mb-3 uppercase tracking-wider">
                Our Proven Process
              </p>
              <div className="flex items-center gap-2">
                {["Build", "Attract", "Convert", "Automate", "Scale"].map(
                  (step, index) => (
                    <div key={step} className="flex items-center">
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1 + index * 0.1, duration: 0.3 }}
                        className="px-3 py-1.5 bg-background rounded-lg text-xs font-semibold text-muted hover:bg-gradient-to-r hover:from-brand-orange-deep hover:to-brand-orange hover:text-white transition-all duration-300 cursor-default"
                      >
                        {step}
                      </motion.div>
                      {index < 4 && (
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            delay: 1.2 + index * 0.1,
                            duration: 0.3,
                          }}
                          className="w-4 h-0.5 bg-gradient-to-r from-brand-orange-light to-brand-orange mx-0.5 origin-left"
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </motion.div> */}
          </div>

          {/* Right Column - Visual/Illustration */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative hidden lg:block"
            style={{
              x: mousePosition.x * -0.5,
              y: mousePosition.y * -0.5,
            }}
          >
            {/* Main Dashboard Card */}
            <div className="relative">
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative bg-card rounded-3xl shadow-2xl shadow-black/5 dark:shadow-black/30 border border-border p-6 overflow-hidden"
              >
                {/* Card inner glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-deep/5 to-brand-orange/5 dark:from-brand-orange-deep/10 dark:to-brand-orange/10" />

                <div className="relative">
                  {/* Mock Dashboard Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="text-xs text-caption">
                      TBJ Dashboard
                    </div>
                  </div>

                  {/* Mock Chart */}
                  <div className="space-y-4">
                    <div className="flex items-end gap-2 h-32">
                      {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 50, 75].map(
                        (height, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{
                              delay: 1 + i * 0.1,
                              duration: 0.5,
                              ease: "easeOut",
                            }}
                            className="flex-1 bg-gradient-to-t from-brand-orange-deep to-brand-orange rounded-t-md opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                          />
                        )
                      )}
                    </div>

                    {/* Mock Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Traffic", value: "+245%", color: "orange" },
                        { label: "Leads", value: "+180%", color: "orange" },
                        { label: "Revenue", value: "+320%", color: "orange" },
                      ].map((stat) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.5, duration: 0.3 }}
                          className="bg-stat rounded-xl p-3 text-center"
                        >
                          <div
                            className={`text-lg font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}
                          >
                            {stat.value}
                          </div>
                          <div className="text-xs text-caption">
                            {stat.label}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Elements */}
              <motion.div
                animate={{
                  y: [0, -20, 0],
                  rotate: [0, 5, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
                className="absolute -top-8 -right-8 bg-card rounded-2xl shadow-xl border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-orange/10 dark:bg-brand-orange/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">
                      +98%
                    </div>
                    <div className="text-xs text-caption">
                      Growth Rate
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{
                  y: [0, 15, 0],
                  rotate: [0, -3, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 2,
                }}
                className="absolute -bottom-6 -left-6 bg-card rounded-2xl shadow-xl border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-off-black/5 dark:bg-white/10 rounded-full flex items-center justify-center">
                    <Zap className="w-5 h-5 text-off-black dark:text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">
                      AI Active
                    </div>
                    <div className="text-xs text-caption">
                      Automating 24/7
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Stats Bar - Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-16 lg:mt-20 grid grid-cols-3 gap-4 sm:gap-8 max-w-3xl mx-auto"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 + index * 0.1 }}
              whileHover={{ y: -5 }}
              className="text-center group cursor-default"
            >
              <div className="flex justify-center mb-2">
                <div className="p-2.5 bg-stat rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-caption">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-600"
        >
          <span className="text-xs font-medium uppercase tracking-wider">
            Scroll
          </span>
          <div className="w-5 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 flex justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
            />
          </div>
        </motion.div>
      </motion.div> */}
    </section>
  );
}