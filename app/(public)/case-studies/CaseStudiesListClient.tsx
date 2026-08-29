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
          className="px-4 py-2.5 bg-card border border-border rounded-full text-sm text-muted focus:ring-2 focus:ring-brand-orange outline-none"
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
          className="px-4 py-2.5 bg-card border border-border rounded-full text-sm text-muted focus:ring-2 focus:ring-brand-orange outline-none"
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background text-caption mb-4">
            <Building2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">No case studies found</h3>
          <p className="text-muted">Try a different filter combination.</p>
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
                  className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden hover:shadow-2xl hover:shadow-brand-orange/10 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative h-48 w-full overflow-hidden bg-background">
                    {isValidImageSrc(study.featuredImage) ? (
                      <Image
                        src={study.featuredImage}
                        alt={study.featuredImageAlt || study.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-orange-deep/20 to-brand-orange/20 flex items-center justify-center">
                        <Building2 className="text-caption" size={32} />
                      </div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-card/90 backdrop-blur text-xs font-semibold rounded-full text-brand-orange-deep dark:text-brand-orange-light">
                        {study.serviceType}
                      </span>
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <span className="text-xs font-medium text-muted mb-2">{study.industry}</span>
                    <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-2 group-hover:text-brand-orange-deep dark:group-hover:text-brand-orange-light transition-colors">
                      {study.title}
                    </h3>
                    <p className="text-sm text-muted line-clamp-2 flex-1 mb-4">
                      {study.excerpt || study.results || "Click to read the full story."}
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-orange-deep dark:text-brand-orange-light">
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
