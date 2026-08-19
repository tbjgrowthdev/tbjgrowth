"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, Star, TrendingUp } from "lucide-react";
import { isValidImageSrc } from "@/lib/utils";

const CARD_THEMES = [
  { gradient: "from-blue-500 to-cyan-500", bgGradient: "from-blue-500/10 to-cyan-500/10", shadowGlow: "shadow-blue-500/25" },
  { gradient: "from-purple-500 to-pink-500", bgGradient: "from-purple-500/10 to-pink-500/10", shadowGlow: "shadow-purple-500/25" },
  { gradient: "from-green-500 to-emerald-500", bgGradient: "from-green-500/10 to-emerald-500/10", shadowGlow: "shadow-green-500/25" },
  { gradient: "from-orange-500 to-red-500", bgGradient: "from-orange-500/10 to-red-500/10", shadowGlow: "shadow-orange-500/25" },
  { gradient: "from-indigo-500 to-blue-600", bgGradient: "from-indigo-500/10 to-blue-600/10", shadowGlow: "shadow-indigo-500/25" },
  { gradient: "from-violet-500 to-purple-600", bgGradient: "from-violet-500/10 to-purple-600/10", shadowGlow: "shadow-violet-500/25" },
];

type CaseStudy = {
  id: string;
  slug: string;
  title: string;
  clientName: string;
  industry: string;
  serviceType: string;
  excerpt: string | null;
  results: string | null;
  featuredImage: string | null;
  featuredImageAlt: string | null;
};

function CaseStudyCard({ study, index }: { study: CaseStudy; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });
  const theme = CARD_THEMES[index % CARD_THEMES.length];

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      className="group"
    >
      <Link
        href={`/case-studies/${study.slug}`}
        className={`relative flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl ${theme.shadowGlow} hover:-translate-y-1 transition-all duration-500`}
      >
        {/* Image */}
        <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
          {isValidImageSrc(study.featuredImage) ? (
            <Image
              src={study.featuredImage}
              alt={study.featuredImageAlt || study.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} flex items-center justify-center`}>
              <Building2 className="w-10 h-10 text-gray-400 dark:text-gray-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
          <span
            className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${theme.gradient} text-white shadow-lg`}
          >
            {study.serviceType}
          </span>
        </div>

        {/* Content */}
        <div className="relative flex-1 flex flex-col p-6">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${theme.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
          />
          <div className="relative">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              {study.industry}
            </p>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all duration-300">
              {study.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 mb-4 flex-1">
              {study.excerpt || "Click to see the full growth story."}
            </p>

            {study.results && (
              <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${theme.bgGradient} flex-shrink-0`}>
                  <TrendingUp className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                </div>
                <span
                  className={`text-sm font-bold bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}
                >
                  {study.results}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">{study.clientName}</span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                View Story
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function CaseStudies({ caseStudies }: { caseStudies: CaseStudy[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section
      id="case-studies"
      ref={sectionRef}
      className="relative py-20 lg:py-28 bg-gray-50 dark:bg-gray-900 transition-colors duration-500 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]" />
        <motion.div
          animate={{ x: [0, 50, -30, 0], y: [0, -30, 40, 0], scale: [1, 1.2, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 right-1/4 w-96 h-96 rounded-full blur-3xl bg-blue-500/5"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-4"
          >
            <Star className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Featured Projects</span>
          </motion.div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Case{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Studies
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real results from real clients. See how we&apos;ve helped businesses transform their digital presence and achieve measurable growth.
          </p>
        </motion.div>

        {/* Grid or Empty State */}
        {caseStudies.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-lg mx-auto text-center py-16 px-8 rounded-3xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700"
          >
            <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">New Success Stories Coming Soon</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We're putting the finishing touches on our latest client results — check back shortly.
            </p>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {caseStudies.map((study, index) => (
              <CaseStudyCard key={study.id} study={study} index={index} />
            ))}
          </div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12 lg:mt-16"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
            <Link
              href="/case-studies"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-2xl shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/40 transition-shadow duration-300"
            >
              <span>View All Case Studies</span>
              <ArrowUpRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
