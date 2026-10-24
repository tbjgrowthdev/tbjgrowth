"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";
import Reveal from "@/components/home/Reveal";

// Shown until an admin adds real systems in the CMS.
const fallbackProducts = [
  {
    id: "ai-analytics",
    iconName: "BrainCircuit",
    title: "TBJ Intelligence",
    tagline: "AI Analytics Suite",
    description:
      "An analytics platform that uses machine learning to predict trends, identify opportunities and automate reporting, giving you insights before your competition does.",
    features: [
      "Predictive analytics & forecasting",
      "Automated anomaly detection",
      "Natural language querying",
      "Real-time competitor tracking",
      "Custom AI model training",
    ],
    status: "Beta Q4 2026",
    progress: 75,
    quarterly: "Q4 2026",
    availability: "Closed beta",
  },
];

function normalise(product: any) {
  return {
    ...product,
    features: typeof product.features === "string" ? JSON.parse(product.features) : product.features || [],
    iconName: product.iconName || "BrainCircuit",
  };
}

function ProductDetail({ product, onClose }: { product: any; onClose: () => void }) {
  const Icon = getIcon(product.iconName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={product.title}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-background p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-card hover:text-foreground"
        >
          <X size={18} />
        </button>
        <Icon className="h-7 w-7 text-brand-500" />
        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{product.title}</h3>
        <p className="mt-1 text-caption">{product.tagline}</p>
        <p className="mt-5 leading-relaxed text-muted">{product.description}</p>

        <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
          {product.features.map((f: string) => (
            <li key={f} className="py-3 text-foreground">
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted">{product.status}</span>
          {typeof product.progress === "number" && <span className="font-mono text-foreground">{product.progress}%</span>}
        </div>
        {typeof product.progress === "number" && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-card">
            <div className="h-full bg-brand-500" style={{ width: `${product.progress}%` }} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function TBJSystemsClient({ dbSystems }: { dbSystems?: any[] }) {
  const [selected, setSelected] = useState<any | null>(null);
  const products = (dbSystems && dbSystems.length > 0 ? dbSystems : fallbackProducts).map(normalise);

  return (
    <>
      <section id="tbj-systems" className="bg-background py-24 lg:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-3xl">
            <p className="eyebrow mb-5">In development</p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
              The <span className="serif-accent">AI tools</span> we&apos;re building.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              AI-powered tools for the businesses we already serve. An early look at what&apos;s coming.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
            {products.map((p, i) => {
              const Icon = getIcon(p.iconName);
              return (
                <Reveal key={p.id || i} delay={(i % 3) * 0.07}>
                  <button
                    onClick={() => setSelected(p)}
                    className="group flex h-full w-full flex-col rounded-2xl border border-border bg-card p-7 text-left transition-colors hover:border-foreground"
                  >
                    <div className="flex items-start justify-between">
                      <Icon className="h-6 w-6 text-brand-500" />
                      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
                        {p.status || p.availability}
                      </span>
                    </div>
                    <h3 className="mt-10 text-2xl font-medium tracking-tight text-foreground">{p.title}</h3>
                    <p className="mt-1 text-sm text-caption">{p.tagline}</p>
                    <p className="mt-4 line-clamp-3 flex-1 text-[15px] leading-relaxed text-muted">{p.description}</p>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                      Learn more
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selected && <ProductDetail product={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
}
