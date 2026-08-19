"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Rocket,
  Clock,
  ChevronRight,
} from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";

// Fallback future products data
const fallbackProducts = [
  {
    id: "ai-analytics",
    icon: "BrainCircuit",
    title: "TBJ Intelligence",
    tagline: "AI Analytics Suite",
    description:
      "A revolutionary analytics platform that uses machine learning to predict trends, identify opportunities, and automate reporting — giving you insights before your competition does.",
    features: [
      "Predictive analytics & forecasting",
      "Automated anomaly detection",
      "Natural language querying",
      "Real-time competitor tracking",
      "Custom AI model training",
    ],
    status: "Beta Q4 2026",
    progress: 75,
    gradient: "from-blue-500 to-cyan-500",
    bgLight: "from-blue-50 to-cyan-50",
    bgDark: "from-blue-500/10 to-cyan-500/10",
    textGradient: "from-blue-600 to-cyan-600",
    borderColor: "border-blue-200 dark:border-blue-500/30",
    glowColor: "shadow-blue-500/25",
    accentColor: "bg-blue-500",
    shape: "Circle",
    quarterly: "Q4 2026",
    availability: "Closed Beta",
  },
];

// Helper to calculate derived colors based on gradient
function processProduct(product: any) {
  const gradient = product.gradient || "from-blue-500 to-cyan-500";
  const colorName = gradient.split('-')[1] || "blue";

  return {
    ...product,
    bgLight: `from-${colorName}-50 to-${colorName}-100`, // Approximation
    bgDark: `from-${colorName}-500/10 to-${colorName}-500/10`,
    textGradient: `from-${colorName}-600 to-${colorName}-600`,
    borderColor: `border-${colorName}-200 dark:border-${colorName}-500/30`,
    glowColor: `shadow-${colorName}-500/25`,
    accentColor: `bg-${colorName}-500`,
    features: typeof product.features === 'string' ? JSON.parse(product.features) : product.features,
    shapeName: product.shapeName || "Circle",
    iconName: product.iconName || "BrainCircuit",
  };
}

// Detailed Product View Component
function ProductDetail({
  product,
  onClose,
}: {
  product: any;
  onClose: () => void;
}) {
  const ShapeIcon = getIcon(product.shapeName);
  const ProductIcon = getIcon(product.iconName);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:scale-110 transition-transform"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Gradient header */}
        <div className={`relative p-8 lg:p-10 bg-gradient-to-br ${product.bgLight} dark:bg-gradient-to-br ${product.bgDark}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${product.gradient} text-white shadow-lg ${product.glowColor}`}>
              <ProductIcon className="w-7 h-7" />
            </div>
            <div>
              <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r ${product.gradient} text-white mb-1`}>
                {product.status}
              </span>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                {product.title}
              </h2>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-2">
            {product.tagline}
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Content */}
        <div className="p-8 lg:p-10 space-y-8">
          {/* Progress */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Development Progress</span>
              <span className={`text-sm font-bold bg-gradient-to-r ${product.textGradient} bg-clip-text text-transparent`}>
                {product.progress}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${product.progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className={`h-full bg-gradient-to-r ${product.gradient} rounded-full`}
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Key Features</h4>
            <div className="space-y-3">
              {product.features && product.features.map((feature: any, i: number) => {
                const featureText = typeof feature === 'string' ? feature : feature.text;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                  >
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${product.gradient} flex items-center justify-center flex-shrink-0`}>
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{featureText}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Clock className="w-5 h-5 text-gray-400 mb-2" />
              <div className="text-sm text-gray-500 dark:text-gray-400">Expected Release</div>
              <div className="font-bold text-gray-900 dark:text-white">{product.quarterly}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Rocket className="w-5 h-5 text-gray-400 mb-2" />
              <div className="text-sm text-gray-500 dark:text-gray-400">Availability</div>
              <div className="font-bold text-gray-900 dark:text-white">{product.availability}</div>
            </div>
          </div>

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-4 bg-gradient-to-r ${product.gradient} text-white font-semibold rounded-2xl shadow-lg ${product.glowColor} flex items-center justify-center gap-2 text-lg`}
          >
            <span>Join Early Access</span>
            <Rocket className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Product Card
function ProductCard({
  product,
  index,
  onSelect,
}: {
  product: any;
  index: number;
  onSelect: (product: any) => void;
}) {
  const ShapeIcon = getIcon(product.shapeName);
  const ProductIcon = getIcon(product.iconName);
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, amount: 0.3 });

  return (
    <motion.div
      key={product.id || index}
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.12, duration: 0.5 }}
      onClick={() => onSelect(product)}
      className="group relative cursor-pointer"
    >
      {/* Card */}
      <div className={`relative h-full bg-white dark:bg-gray-900 rounded-2xl border ${product.borderColor} overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/50 dark:hover:shadow-black/50 hover:-translate-y-2`}>
        {/* Top accent bar */}
        <div className={`h-1.5 bg-gradient-to-r ${product.gradient}`} />

        <div className="p-6">
          {/* Shape & Icon */}
          <div className="flex items-center justify-between mb-5">
            <motion.div
              whileHover={{ rotate: 15 }}
              className={`p-3 rounded-xl bg-gradient-to-br ${product.bgLight} dark:bg-gradient-to-br ${product.bgDark}`}
            >
              <ProductIcon className={`w-6 h-6 text-transparent bg-clip-text bg-gradient-to-br ${product.textGradient}`} />
            </motion.div>
            <ShapeIcon className={`w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors`} />
          </div>

          {/* Status badge */}
          <div className="mb-3">
            <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r ${product.gradient} text-white`}>
              {product.status}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
            {product.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {product.tagline}
          </p>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-500 dark:text-gray-500">Progress</span>
              <span className={`font-bold bg-gradient-to-r ${product.textGradient} bg-clip-text text-transparent`}>
                {product.progress}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={isInView ? { width: `${product.progress}%` } : {}}
                transition={{ duration: 1, delay: 0.3 + index * 0.1 }}
                className={`h-full bg-gradient-to-r ${product.gradient} rounded-full`}
              />
            </div>
          </div>

          {/* Hover CTA */}
          <div className={`flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${product.textGradient} bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
            <span>Learn More</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Glow on hover */}
      <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-20 blur-lg transition-opacity duration-500 -z-10`} />
    </motion.div>
  );
}

// Main Section
export default function TBJSystemsClient({ dbSystems }: { dbSystems?: any[] }) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const rawProducts = dbSystems && dbSystems.length > 0 ? dbSystems : fallbackProducts;
  const products = rawProducts.map(processProduct);

  return (
    <>
      <section
        id="tbj-systems"
        ref={sectionRef}
        className="relative py-20 lg:py-28 bg-white dark:bg-gray-950 transition-colors duration-500 overflow-hidden"
      >
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_30%,transparent_100%)]" />

          {/* Gradient blobs */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl bg-blue-500/10 dark:bg-blue-500/5"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 12, repeat: Infinity, delay: 2 }}
            className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full blur-3xl bg-purple-500/10 dark:bg-purple-500/5"
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
              <Rocket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                What's Coming Next
              </span>
            </motion.div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              TBJ{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Systems
              </span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We're building the next generation of AI-powered SaaS products.
              These tools will redefine how businesses grow, automate, and scale.
            </p>
          </motion.div>

          {/* Product Cards Grid - Unique Design */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <ProductCard
                key={product.id || index}
                product={product}
                index={index}
                onSelect={setSelectedProduct}
              />
            ))}
          </div>

          {/* Bottom timeline info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-14 lg:mt-18 flex flex-wrap items-center justify-center gap-6 lg:gap-10"
          >
            {[
              { label: "Products in Development", value: products.length.toString() },
              { label: "First Release", value: products.length > 0 ? products[0].quarterly || "Q4 2026" : "Q4 2026" },
              { label: "Early Access Spots", value: "Limited" },
              { label: "Integration Partners", value: "100+" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                  {item.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {item.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
