// app/about/page.tsx
"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Target,
  Eye,
  Heart,
  Zap,
  TrendingUp,
  Users,
  Globe,
  Award,
  Star,
  Quote,
  Calendar,
  Clock,
  Shield,
  Rocket,
  BrainCircuit,
  Workflow,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Twitter,
  Instagram,
  CheckCircle2,
  Building2,
  ThumbsUp,
  Timer,
  DollarSign,
} from "lucide-react";


// Mission & Values
const values = [
  {
    icon: Target,
    title: "Results First",
    description: "Everything we do is measured by the results we deliver. No vanity metrics, just real business growth.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Heart,
    title: "True Partnership",
    description: "We become an extension of your team. Your goals are our goals, and your success is our success.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    description: "No black boxes. You get real-time dashboards, clear reporting, and full visibility into every campaign.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    icon: Zap,
    title: "AI-First Approach",
    description: "We leverage cutting-edge AI to deliver faster, smarter, and more efficient solutions than traditional agencies.",
    gradient: "from-orange-500 to-red-500",
  },
  {
    icon: Shield,
    title: "Reliability",
    description: "When we say we'll deliver, we deliver. 98% client retention rate speaks for itself.",
    gradient: "from-indigo-500 to-blue-600",
  },
  {
    icon: Rocket,
    title: "Continuous Innovation",
    description: "We're always learning, testing, and implementing the latest technologies to keep you ahead of the curve.",
    gradient: "from-violet-500 to-purple-600",
  },
];

// Team members
const team = [
  {
    name: "Alex Thompson",
    role: "Co-Founder & CEO",
    bio: "10+ years in digital growth. Previously scaled 3 startups to 7-figure exits.",
    gradient: "from-blue-500 to-cyan-500",
    initials: "AT",
  },
  {
    name: "Sarah Mitchell",
    role: "Co-Founder & CTO",
    bio: "Full-stack developer turned AI specialist. Built systems processing 10M+ data points daily.",
    gradient: "from-purple-500 to-pink-500",
    initials: "SM",
  },
  {
    name: "James Cooper",
    role: "Head of Growth",
    bio: "Former Google Ads strategist. Managed £5M+ in ad spend across 200+ accounts.",
    gradient: "from-orange-500 to-red-500",
    initials: "JC",
  },
  {
    name: "Emma Richards",
    role: "Creative Director",
    bio: "Award-winning designer. Created brand identities for Fortune 500 companies.",
    gradient: "from-green-500 to-emerald-500",
    initials: "ER",
  },
];

// Timeline milestones
const milestones = [
  { year: "2018", title: "Founded", description: "TBJ Growth started as a two-person team in London" },
  { year: "2019", title: "First 50 Clients", description: "Reached 50 active clients through referrals alone" },
  { year: "2020", title: "AI Integration", description: "Pioneered AI-powered marketing automation" },
  { year: "2021", title: "100+ Projects", description: "Delivered 100+ successful digital projects" },
  { year: "2022", title: "Team Growth", description: "Expanded to 15+ specialists across the UK" },
  { year: "2023", title: "TBJ Systems", description: "Started developing proprietary AI SaaS products" },
  { year: "2024", title: "Global Reach", description: "Serving clients across UK, Europe, and North America" },
];

// Stats
const stats = [
  { value: "150+", label: "Projects Delivered", icon: Building2 },
  { value: "50+", label: "Active Clients", icon: Users },
  { value: "98%", label: "Client Retention", icon: ThumbsUp },
  { value: "4.9/5", label: "Client Rating", icon: Star },
];

export default function AboutPageClient() {
  return (
    <main className="relative bg-white dark:bg-gray-950 transition-colors duration-500">
      {/* <Navbar /> */}

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-blue-500/10"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-6"
              >
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">About Us</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight leading-tight"
              >
                We Help Businesses{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                  Grow Smarter
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6"
              >
                TBJ Growth is a UK-based digital growth agency that combines proven marketing strategies with cutting-edge AI technology. We don't just build websites or run ads — we build complete growth ecosystems that scale your business.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8"
              >
                From startups to established enterprises, we've helped 50+ businesses achieve measurable growth through our Build → Attract → Convert → Automate → Scale framework.
              </motion.p>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
              >
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="text-center p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* Right - Visual */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <div className="aspect-[4/3] bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
                  <div className="text-center text-white p-8">
                    <Building2 className="w-16 h-16 mx-auto mb-4 opacity-80" />
                    <p className="text-2xl font-bold">TBJ Growth</p>
                    <p className="text-white/70">Building Since 2018</p>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium">
                  UK Based
                </div>
                <div className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium">
                  50+ Happy Clients
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="relative py-20 lg:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Values</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              These six principles guide everything we do — from strategy to execution.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${value.gradient} text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{value.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="relative py-20 lg:py-28 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Meet the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Team</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A passionate team of strategists, designers, developers, and AI specialists.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group text-center p-6 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
              >
                {/* Avatar */}
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  {member.initials}
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{member.name}</h3>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-3">{member.role}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="relative py-20 lg:py-28 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Journey</span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              From a small London office to serving clients worldwide.
            </p>
          </motion.div>

          <div className="relative">
            {/* Center line */}
            <div className="absolute left-4 lg:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 lg:-translate-x-px" />

            <div className="space-y-8">
              {milestones.map((milestone, index) => {
                const isEven = index % 2 === 0;
                return (
                  <motion.div
                    key={milestone.year}
                    initial={{ opacity: 0, x: isEven ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className={`relative flex items-start gap-6 lg:gap-0 ${
                      isEven ? "lg:flex-row" : "lg:flex-row-reverse"
                    }`}
                  >
                    {/* Dot */}
                    <div className="absolute left-4 lg:left-1/2 w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full -translate-x-1/2 mt-1.5 ring-4 ring-white dark:ring-gray-900 z-10" />

                    {/* Content */}
                    <div className={`ml-10 lg:ml-0 lg:w-1/2 ${isEven ? "lg:pr-12 lg:text-right" : "lg:pl-12"}`}>
                      <div className="p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm inline-block">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{milestone.year}</span>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mt-1">{milestone.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{milestone.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 lg:py-28 bg-white dark:bg-gray-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 rounded-3xl p-10 lg:p-14 border border-blue-200/50 dark:border-blue-500/20"
          >
            <MessageSquare className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-6" />
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Let's Build Something Great Together
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Ready to grow? Let's talk about your goals and how we can help you achieve them.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.a
                href="/contact"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 transition-shadow group"
              >
                <Calendar className="w-5 h-5" />
                <span>Book a Free Strategy Call</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="/services"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
              >
                <span>View Our Services</span>
                <ArrowRight className="w-4 h-4" />
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* <Footer /> */}
    </main>
  );
}