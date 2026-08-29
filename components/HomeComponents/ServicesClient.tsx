"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ArrowRight, Settings } from "lucide-react";
import { getIcon } from "@/components/ui/IconRenderer";

// Fallback Service definitions (used if dbServices is empty)
const fallbackServices = [
    {
        id: "web-design",
        iconName: "Globe",
        title: "Web Design & Development",
        subtitle: "Conversion-focused websites",
        description:
            "Custom-built, mobile-first websites designed to convert visitors into customers. Fast, SEO-optimized, and built with modern frameworks.",
        features: [
            { icon: "Monitor", text: "Responsive Design" },
            { icon: "Palette", text: "UI/UX Excellence" },
            { icon: "Code2", text: "Next.js & React" },
            { icon: "Zap", text: "Performance Optimized" },
        ],
        gradient: "from-brand-orange-deep to-brand-orange",
        bgGradient: "from-brand-orange/10 to-brand-orange/10",
        shadowColor: "shadow-brand-orange/20",
        stat: "98%",
        statLabel: "PageSpeed Score",
        color: "orange",
    },
    {
        id: "smm",
        iconName: "Share2",
        title: "Social Media Marketing",
        subtitle: "Build your community",
        description:
            "Strategic social media management across all major platforms. Content creation, community engagement, and paid social campaigns that drive real results.",
        features: [
            { icon: "Users", text: "Community Growth" },
            { icon: "MessageSquare", text: "Content Strategy" },
            { icon: "Megaphone", text: "Paid Social Ads" },
            { icon: "TrendingUp", text: "Analytics & Insights" },
        ],
        gradient: "from-charcoal to-off-black",
        bgGradient: "from-charcoal/10 to-off-black/10",
        shadowColor: "shadow-charcoal/20",
        stat: "2.5M+",
        statLabel: "Monthly Reach",
        color: "charcoal",
    },
];

// Service Card Component
function ServiceCard({
    service,
    index,
    isActive,
    onClick,
}: {
    service: any;
    index: number;
    isActive: boolean;
    onClick: () => void;
}) {
    const Icon = getIcon(service.iconName || "Circle");

    // parse features if it's a string from DB
    const featuresList = typeof service.features === 'string' ? JSON.parse(service.features) : service.features;
    
    // derive fields that might not be in DB but are needed
    const bgGradient = service.bgGradient || (service.gradient ? service.gradient.replace(/-\d{3}/g, '$&/10') : "from-brand-orange/10 to-brand-orange/10");
    const shadowColor = service.shadowColor || (service.gradient ? `shadow-${service.gradient.split('-')[1]}-500/20` : "shadow-brand-orange/20");

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            onClick={onClick}
            className={`group relative cursor-pointer rounded-2xl p-6 transition-all duration-500 border ${isActive
                    ? `bg-gradient-to-br ${bgGradient} border-transparent shadow-2xl ${shadowColor} scale-[1.02] z-10`
                    : "bg-card border-border hover:border-accent-border hover:shadow-xl hover:scale-[1.01]"
                }`}
        >
            {/* Card Content */}
            <div className="relative z-10">
                {/* Icon */}
                <motion.div
                    animate={isActive ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`inline-flex p-3 rounded-xl mb-4 transition-all duration-500 ${isActive
                            ? `bg-gradient-to-br ${service.gradient} text-white shadow-lg`
                            : "bg-background text-muted group-hover:bg-tint"
                        }`}
                >
                    <Icon className="w-6 h-6" />
                </motion.div>

                {/* Title & Subtitle */}
                <h3 className="text-lg font-bold text-foreground mb-1">
                    {service.title}
                </h3>
                <p className="text-sm text-caption mb-3">
                    {service.subtitle}
                </p>

                {/* Description */}
                <p className="text-sm text-muted leading-relaxed mb-4">
                    {service.description}
                </p>

                {/* Stat Badge */}
                {service.stat && (
                    <div className="flex items-center gap-3 mb-4">
                        <div
                            className={`text-2xl font-bold bg-gradient-to-r ${service.gradient} bg-clip-text text-transparent`}
                        >
                            {service.stat}
                        </div>
                        <div className="text-xs text-caption">
                            {service.statLabel}
                        </div>
                    </div>
                )}

                {/* Expanded Features */}
                <motion.div
                    initial={false}
                    animate={{
                        height: isActive ? "auto" : 0,
                        opacity: isActive ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                >
                    <div className="space-y-2 pt-3 border-t border-border">
                        {Array.isArray(featuresList) && featuresList.map((feature: any, i: number) => {
                            const FeatureIcon = getIcon(feature.icon || "Check");
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={isActive ? { opacity: 1, x: 0 } : {}}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center gap-2 text-sm text-muted"
                                >
                                    <FeatureIcon className="w-4 h-4 text-caption" />
                                    <span>{feature.text}</span>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* CTA Link */}
                <motion.div
                    initial={false}
                    animate={{
                        height: isActive ? "auto" : 0,
                        opacity: isActive ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="overflow-hidden"
                >
                    <button
                        className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold bg-gradient-to-r ${service.gradient} bg-clip-text text-transparent group/btn`}
                    >
                        <span>Learn More</span>
                        <ArrowRight className="w-4 h-4 text-transparent group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </motion.div>
            </div>

            {/* Hover Glow Effect */}
            <div
                className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${bgGradient} blur-xl`}
            />
        </motion.div>
    );
}

// Preview Panel Component
function PreviewPanel({
    service,
}: {
    service: any;
}) {
    if (!service) return null;

    const Icon = getIcon(service.iconName || "Circle");
    const featuresList = typeof service.features === 'string' ? JSON.parse(service.features) : service.features;
    const bgGradient = service.bgGradient || (service.gradient ? service.gradient.replace(/-\d{3}/g, '$&/10') : "from-brand-orange/10 to-brand-orange/10");
    const shadowColor = service.shadowColor || (service.gradient ? `shadow-${service.gradient.split('-')[1]}-500/20` : "shadow-brand-orange/20");

    return (
        <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
            className="relative bg-card rounded-3xl shadow-2xl shadow-black/10 dark:shadow-black/40 border border-border overflow-hidden"
        >
            {/* Preview Background */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50 dark:opacity-30`}
            />

            <div className="relative p-8">
                {/* Preview Header */}
                <div className="flex items-center gap-4 mb-8">
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className={`p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white shadow-lg`}
                    >
                        <Icon className="w-8 h-8" />
                    </motion.div>
                    <div>
                        <h3 className="text-2xl font-bold text-foreground">
                            {service.title}
                        </h3>
                        <p className="text-caption">
                            {service.subtitle}
                        </p>
                    </div>
                </div>

                {/* Mock Dashboard Preview */}
                <div className="space-y-4 mb-8">
                    {/* Chart Mock */}
                    <div className="bg-background rounded-2xl p-6">
                        <div className="flex items-end gap-2 h-24">
                            {[30, 50, 40, 70, 55, 85, 60, 90, 45, 75, 55, 80].map(
                                (height, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${height}%` }}
                                        transition={{ delay: i * 0.05, duration: 0.4 }}
                                        className={`flex-1 rounded-t-md bg-gradient-to-t ${service.gradient} opacity-70`}
                                    />
                                )
                            )}
                        </div>
                    </div>

                    {/* Feature Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {Array.isArray(featuresList) && featuresList.map((feature: any, i: number) => {
                            const FeatureIcon = getIcon(feature.icon || "Check");
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-3 bg-card rounded-xl p-4 border border-border"
                                >
                                    <div
                                        className={`p-2 rounded-lg bg-gradient-to-br ${bgGradient}`}
                                    >
                                        <FeatureIcon className="w-4 h-4 text-muted" />
                                    </div>
                                    <span className="text-sm font-medium text-muted">
                                        {feature.text}
                                    </span>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* CTA */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-4 bg-gradient-to-r ${service.gradient} text-white font-semibold rounded-2xl shadow-lg ${shadowColor} flex items-center justify-center gap-2`}
                >
                    <span>Explore {service.title}</span>
                    <ArrowRight className="w-5 h-5" />
                </motion.button>
            </div>
        </motion.div>
    );
}

export default function ServicesClient({ dbServices }: { dbServices?: any[] }) {
    const servicesList = dbServices && dbServices.length > 0 ? dbServices : fallbackServices;
    const [activeService, setActiveService] = useState<number | null>(0);
    const sectionRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(sectionRef, { amount: 0.1 });

    return (
        <section
            id="services"
            ref={sectionRef}
            className="relative py-20 lg:py-28 bg-card transition-colors duration-500 overflow-hidden"
        >
            {/* Background Elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_40%,transparent_100%)]" />

                {/* Floating gradient orbs */}
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                        x: [0, 50, 0],
                        y: [0, -30, 0],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl bg-gradient-to-br from-brand-orange-deep/10 to-brand-orange/10"
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
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-tint border border-brand-orange/20 rounded-full mb-4"
                    >
                        <Settings className="w-4 h-4 text-brand-orange-deep dark:text-brand-orange-light" />
                        <span className="text-sm font-medium text-brand-orange-deep dark:text-brand-orange-light">
                            What We Offer
                        </span>
                    </motion.div>

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                        Agency{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-deep to-brand-orange">
                            Services
                        </span>
                    </h2>
                    <p className="text-lg text-muted max-w-2xl mx-auto">
                        End-to-end digital services to build your presence, attract your
                        audience, and scale your business with AI-powered efficiency.
                    </p>
                </motion.div>

                {/* Services Grid + Preview */}
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    {/* Services Cards Grid */}
                    <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                        {servicesList.map((service, index) => (
                            <ServiceCard
                                key={service.id}
                                service={service}
                                index={index}
                                isActive={activeService === index}
                                onClick={() =>
                                    setActiveService(activeService === index ? null : index)
                                }
                            />
                        ))}
                    </div>

                    {/* Preview Panel */}
                    <div className="hidden lg:block lg:col-span-1 sticky top-24">
                        <AnimatePresence mode="wait">
                            {activeService !== null && (
                                <PreviewPanel service={servicesList[activeService]} />
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Bottom Trust Bar */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="mt-16 lg:mt-20 flex flex-wrap items-center justify-center gap-6 lg:gap-12 text-center"
                >
                    {[
                        { value: "150+", label: "Projects Delivered" },
                        { value: "50+", label: "Happy Clients" },
                        { value: "6", label: "Core Services" },
                        { value: "24/7", label: "Support & Monitoring" },
                    ].map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            whileHover={{ y: -5 }}
                            className="cursor-default"
                        >
                            <div className="text-2xl lg:text-3xl font-bold text-foreground">
                                {stat.value}
                            </div>
                            <div className="text-sm text-caption mt-1">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
