// app/about/page.tsx
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
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
  UserCheck,
  Cpu,
} from "lucide-react";


// Mission & Values
const values = [
  {
    icon: Target,
    title: "Results First",
    description: "Every engagement is measured against leads, bookings, or revenue — not likes or impressions.",
    gradient: "from-brand-orange-deep to-brand-orange",
  },
  {
    icon: UserCheck,
    title: "Direct Access",
    description: "You work with the person doing the work, not a rotating account manager.",
    gradient: "from-charcoal to-off-black",
  },
  {
    icon: Eye,
    title: "Radical Transparency",
    description: "Real dashboards and monthly reports, no black-box 'trust us' reporting.",
    gradient: "from-brand-orange-deep to-brand-orange",
  },
  {
    icon: Cpu,
    title: "AI-Assisted, Human-Led",
    description: "AI speeds up production and follow-up; strategy and judgment stay human.",
    gradient: "from-charcoal to-off-black",
  },
  {
    icon: Clock,
    title: "Honest Timelines",
    description: "We tell you what's realistic before you sign, not after.",
    gradient: "from-brand-orange-deep to-brand-orange",
  },
  {
    icon: Heart,
    title: "Long-Term Partnership",
    description: "We'd rather grow slowly with clients who stay than churn through short-term projects.",
    gradient: "from-charcoal to-off-black",
  },
];

// Team members
const team = [
  {
    name: "Jabber Sharker",
    role: "Founder & CEO",
    bio: "Driving growth strategies and agency vision. Specializes in scaling digital businesses globally.",
    gradient: "from-brand-orange-deep to-brand-orange",
    initials: "JS",
  },
  {
    name: "Sabbin Islam Shojib",
    role: "Co-Founder & CTO",
    bio: "Leading tech architecture and web development. Focused on high-performance solutions and automation.",
    gradient: "from-charcoal to-off-black",
    initials: "SS",
  },
  {
    name: "Kazi Mozammel Hossen",
    role: "Head of Growth",
    bio: "Managing performance marketing and client acquisition strategies to ensure maximum ROI.",
    gradient: "from-brand-orange-deep to-brand-orange",
    initials: "KH",
  },
];

// Timeline milestones
const milestones = [
  { year: "2026", title: "Agency Founded", description: "Launched TBJ Growth Tech in Dhaka to serve global clients." },
  { year: "2026", title: "Core Process Built", description: "Established our integrated Build → Attract → Convert engine." },
  { year: "2026", title: "Global Reach", description: "Onboarded initial remote clients across the UK and US." },
];

// Stats
const stats = [
  { value: "50+", label: "Projects Delivered", icon: Building2 },
  { value: "06+", label: "Active Clients", icon: Users },
  { value: "95%", label: "Client Retention", icon: ThumbsUp },
  { value: "4.9/5", label: "Client Rating", icon: Star },
];

export default function AboutPageClient() {
  return (
    <main className="relative bg-background transition-colors duration-500">
      {/* <Navbar /> */}

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl bg-brand-orange/10"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cream to-ivory dark:from-brand-orange/10 dark:to-brand-orange-light/10 border border-brand-orange/20 dark:border-brand-orange/20 rounded-full mb-6"
              >
                <Sparkles className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
                <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">About Us</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight leading-tight"
              >
                A Growth Team Built in Dhaka,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
                  Working for Clients Worldwide
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg text-muted leading-relaxed mb-6"
              >
                TBJ Growth Tech was founded by Shojib to give UK and US small businesses access to the same website, advertising, and automation systems that larger companies pay agency-of-record rates for — built by a Dhaka-based team at a fraction of the cost, without cutting corners on quality.

              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg text-muted leading-relaxed mb-8"
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
                    <div key={stat.label} className="text-center p-4 rounded-2xl bg-stat border border-border">
                      <Icon className="w-5 h-5 text-brand-orange-deep dark:text-brand-orange-light mx-auto mb-2" />
                      <div className="text-xl font-bold text-foreground">{stat.value}</div>
                      <div className="text-xs text-muted">{stat.label}</div>
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
                <div className="relative aspect-[4/3]">
                  <Image
                    src="/we.jpg"
                    alt="The TBJ Growth Tech team"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-black/10" />
                </div>
                {/* Decorative elements */}
                <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium">
                  UK Based
                </div>
                <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-medium">
                  06+ Happy Clients
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="relative py-20 lg:py-28 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">Values</span>
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
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
                  className="group p-6 rounded-2xl bg-card border border-border hover:border-accent-border hover:shadow-xl transition-all"
                >
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${value.gradient} text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{value.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      {/* <section className="relative py-20 lg:py-28 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Meet the{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">Team</span>
            </h2>
            <p className="text-lg text-muted max-w-2xl mx-auto">
              A passionate team of strategists, designers, developers, and AI specialists.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group text-center p-6 rounded-2xl bg-card border border-border hover:border-accent-border hover:shadow-xl transition-all"
              >
              
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                  {member.initials}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">{member.name}</h3>
                <p className="text-sm text-brand-orange-deep dark:text-brand-orange-light font-medium mb-3">{member.role}</p>
                <p className="text-sm text-muted leading-relaxed">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Timeline Section */}
      <section className="relative py-20 lg:py-28 bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14 lg:mb-18"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Our{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">Journey</span>
            </h2>
            <p className="text-lg text-muted">
              From a small office to serving clients worldwide.
            </p>
          </motion.div>

          <div className="relative">
            {/* Center line */}
            <div className="absolute left-4 lg:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-orange-deep via-brand-orange to-brand-orange-light lg:-translate-x-px" />

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
                    <div className="absolute left-4 lg:left-1/2 w-3 h-3 bg-gradient-to-br from-brand-orange-deep to-brand-orange rounded-full -translate-x-1/2 mt-1.5 ring-4 ring-card z-10" />

                    {/* Content */}
                    <div className={`ml-10 lg:ml-0 lg:w-1/2 ${isEven ? "lg:pr-12 lg:text-right" : "lg:pl-12"}`}>
                      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm inline-block">
                        <span className="text-sm font-bold text-brand-orange-deep dark:text-brand-orange-light">{milestone.year}</span>
                        <h4 className="text-lg font-bold text-foreground mt-1">{milestone.title}</h4>
                        <p className="text-sm text-muted mt-1">{milestone.description}</p>
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
      <section className="relative py-20 lg:py-28 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-cream to-ivory dark:from-brand-orange/10 dark:to-brand-orange-light/10 rounded-3xl p-10 lg:p-14 border border-brand-orange/20 dark:border-brand-orange/20"
          >
            <MessageSquare className="w-12 h-12 text-brand-orange-deep dark:text-brand-orange-light mx-auto mb-6" />
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Let's Build Something Great Together
            </h2>
            <p className="text-lg text-muted mb-8 max-w-lg mx-auto">
              Ready to grow? Let's talk about your goals and how we can help you achieve them.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.a
                href="/contact"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-bold rounded-2xl shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow group"
              >
                <Calendar className="w-5 h-5" />
                <span>Book a Free Strategy Call</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
              <motion.a
                href="/services"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-8 py-4 border-2 border-border text-muted font-semibold rounded-2xl hover:border-brand-orange dark:hover:border-brand-orange hover:text-brand-orange-deep dark:hover:text-brand-orange-light transition-all"
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