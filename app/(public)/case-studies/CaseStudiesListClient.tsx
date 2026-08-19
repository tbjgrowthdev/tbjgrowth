"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Building2 } from "lucide-react";
import { isValidImageSrc } from "@/lib/utils";

type CaseStudy = any;

export default function CaseStudiesListClient({ caseStudies }: { caseStudies: CaseStudy[] }) {
  const [industry, setIndustry] = useState("All");
  const [serviceType, setServiceType] = useState("All");

  const industries = useMemo(
    () => ["All", ...Array.from(new Set(caseStudies.map((c) => c.industry).filter(Boolean)))],
    [caseStudies]
  );
  const serviceTypes = useMemo(
    () => ["All", ...Array.from(new Set(caseStudies.map((c) => c.serviceType).filter(Boolean)))],
    [caseStudies]
  );

  const filtered = caseStudies.filter((c) => {
    const matchesIndustry = industry === "All" || c.industry === industry;
    const matchesService = serviceType === "All" || c.serviceType === serviceType;
    return matchesIndustry && matchesService;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {industries.map((i) => (
            <option key={i} value={i}>
              {i === "All" ? "All Industries" : i}
            </option>
          ))}
        </select>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {serviceTypes.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All Services" : s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No case studies found</h3>
          <p className="text-gray-500 dark:text-gray-400">Try a different filter combination.</p>
        </div>
      ) : (
        <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {filtered.map((study) => (
              <motion.div
                key={study.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="group"
              >
                <Link
                  href={`/case-studies/${study.slug}`}
                  className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {isValidImageSrc(study.featuredImage) ? (
                      <Image
                        src={study.featuredImage}
                        alt={study.featuredImageAlt || study.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                        <Building2 className="text-gray-400" size={32} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur text-xs font-semibold rounded-full text-blue-600 dark:text-blue-400">
                        {study.serviceType}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{study.industry}</span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {study.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 flex-1 mb-4">
                      {study.excerpt || study.results || "Click to read the full story."}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                      Read case study <ArrowUpRight size={14} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
