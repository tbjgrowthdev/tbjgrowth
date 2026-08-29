// "use client";

// import { useRef, useState, useEffect } from "react";
// import { motion, useInView, useScroll, useTransform } from "framer-motion";
// import {
//   ArrowRight,
//   Zap,
//   Star,
//   Clock,
//   Shield,
//   Sparkles,
//   Send,
//   Calendar,
//   CheckCircle2,
//   Users,
//   TrendingUp,
//   MessageSquare,
//   Phone,
//   Mail,
//   MapPin,
//   ChevronRight,
//   Play,
// } from "lucide-react";

// // Urgency counter data
// const launchData = {
//   spotsLeft: 3,
//   totalSpots: 10,
//   nextCohort: "August 2026",
// };

// // Benefits list
// const quickBenefits = [
//   "Free growth strategy session",
//   "Custom roadmap for your business",
//   "No obligation, pure value",
//   "Response within 24 hours",
// ];

// // Stats for social proof
// const urgencyStats = [
//   { icon: Users, value: "50+", label: "Active Clients" },
//   { icon: Clock, value: "48hrs", label: "Avg. Response" },
//   { icon: Star, value: "4.9/5", label: "Client Rating" },
// ];

// // Floating shapes for background
// const floatingShapes = [
//   { shape: "circle", size: "w-20 h-20", color: "bg-blue-500/10", delay: 0 },
//   { shape: "circle", size: "w-16 h-16", color: "bg-purple-500/10", delay: 2 },
//   { shape: "square", size: "w-12 h-12", color: "bg-pink-500/10", delay: 4 },
//   { shape: "circle", size: "w-24 h-24", color: "bg-cyan-500/10", delay: 1 },
//   { shape: "square", size: "w-14 h-14", color: "bg-indigo-500/10", delay: 3 },
//   { shape: "circle", size: "w-18 h-18", color: "bg-orange-500/10", delay: 5 },
// ];

// export default function FinalCTA() {
//   const sectionRef = useRef<HTMLDivElement>(null);
//   const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
//   const [isHoveringCTA, setIsHoveringCTA] = useState(false);

//   const { scrollYProgress } = useScroll({
//     target: sectionRef,
//     offset: ["start end", "end start"],
//   });

//   const scale = useTransform(scrollYProgress, [0, 0.5], [0.95, 1]);
//   const opacity = useTransform(scrollYProgress, [0, 0.3], [0.6, 1]);
//   const y = useTransform(scrollYProgress, [0, 0.5], [50, 0]);

//   // Mouse parallax
//   const handleMouseMove = (e: React.MouseEvent) => {
//     if (sectionRef.current) {
//       const rect = sectionRef.current.getBoundingClientRect();
//       setMousePosition({
//         x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
//         y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
//       });
//     }
//   };

//   return (
//     <section
//       id="contact"
//       ref={sectionRef}
//       onMouseMove={handleMouseMove}
//       className="relative py-20 lg:py-32 bg-white dark:bg-gray-950 transition-colors duration-500 overflow-hidden"
//     >
//       {/* Background Elements */}
//       <div className="absolute inset-0 pointer-events-none">
//         {/* Grid */}
//         <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_30%,transparent_100%)]" />

//         {/* Gradient orbs */}
//         <motion.div
//           style={{
//             x: mousePosition.x * 0.5,
//             y: mousePosition.y * 0.5,
//           }}
//           className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl bg-blue-500/10 dark:bg-blue-500/5"
//         />
//         <motion.div
//           style={{
//             x: mousePosition.x * -0.3,
//             y: mousePosition.y * -0.3,
//           }}
//           className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl bg-purple-500/10 dark:bg-purple-500/5"
//         />

//         {/* Floating shapes */}
//         {floatingShapes.map((shape, i) => (
//           <motion.div
//             key={i}
//             className={`absolute ${shape.size} ${shape.color} rounded-full`}
//             style={{
//               left: `${15 + (i * 17) % 70}%`,
//               top: `${10 + (i * 13) % 70}%`,
//             }}
//             animate={{
//               y: [0, -30, 0, 20, 0],
//               x: [0, 15, -10, 5, 0],
//               scale: [1, 1.2, 0.9, 1.1, 1],
//               rotate: [0, 45, 90, 180, 360],
//             }}
//             transition={{
//               duration: 12 + i * 2,
//               repeat: Infinity,
//               delay: shape.delay,
//               ease: "easeInOut",
//             }}
//           />
//         ))}
//       </div>

//       <motion.div
//         style={{ scale, opacity, y }}
//         className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
//       >
//         <div className="max-w-4xl mx-auto">
//           {/* Main CTA Card */}
//           <motion.div
//             initial={{ opacity: 0, y: 40 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ duration: 0.7 }}
//             className="relative"
//           >
//             {/* Outer glow */}
//             <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-50 blur-2xl" />

//             {/* Main card */}
//             <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
//               {/* Gradient top bar */}
//               <div className="h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />

//               <div className="p-8 sm:p-10 lg:p-14">
//                 <div className="grid lg:grid-cols-5 gap-10 lg:gap-12">
//                   {/* Left - Content */}
//                   <div className="lg:col-span-3">
//                     {/* Badge */}
//                     <motion.div
//                       initial={{ opacity: 0, x: -20 }}
//                       whileInView={{ opacity: 1, x: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.2 }}
//                       className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20 rounded-full mb-6"
//                     >
//                       <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
//                       <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
//                         Limited Availability
//                       </span>
//                     </motion.div>

//                     {/* Headline */}
//                     <motion.h2
//                       initial={{ opacity: 0, y: 20 }}
//                       whileInView={{ opacity: 1, y: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.3 }}
//                       className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight leading-tight"
//                     >
//                       Ready to{" "}
//                       <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
//                         Scale Your Business
//                       </span>
//                       ?
//                     </motion.h2>

//                     {/* Subheadline */}
//                     <motion.p
//                       initial={{ opacity: 0, y: 20 }}
//                       whileInView={{ opacity: 1, y: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.4 }}
//                       className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed"
//                     >
//                       Book a free strategy call with our growth team. We'll analyze
//                       your current digital presence and build a custom roadmap to
//                       help you grow faster.
//                     </motion.p>

//                     {/* Benefits list */}
//                     <motion.div
//                       initial={{ opacity: 0, y: 20 }}
//                       whileInView={{ opacity: 1, y: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.5 }}
//                       className="space-y-3 mb-8"
//                     >
//                       {quickBenefits.map((benefit, i) => (
//                         <motion.div
//                           key={benefit}
//                           initial={{ opacity: 0, x: -10 }}
//                           whileInView={{ opacity: 1, x: 0 }}
//                           viewport={{ once: true }}
//                           transition={{ delay: 0.6 + i * 0.1 }}
//                           className="flex items-center gap-3"
//                         >
//                           <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
//                             <CheckCircle2 className="w-3.5 h-3.5 text-white" />
//                           </div>
//                           <span className="text-gray-700 dark:text-gray-300">
//                             {benefit}
//                           </span>
//                         </motion.div>
//                       ))}
//                     </motion.div>

//                     {/* Urgency + CTA */}
//                     <motion.div
//                       initial={{ opacity: 0, y: 20 }}
//                       whileInView={{ opacity: 1, y: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.7 }}
//                       className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
//                     >
//                       {/* CTA Button */}
//                       <motion.a
//                         href="#book-call"
//                         onMouseEnter={() => setIsHoveringCTA(true)}
//                         onMouseLeave={() => setIsHoveringCTA(false)}
//                         whileHover={{ scale: 1.03 }}
//                         whileTap={{ scale: 0.97 }}
//                         className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-bold rounded-2xl overflow-hidden shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow duration-300"
//                       >
//                         {/* Shine effect */}
//                         <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />

//                         <Calendar className="relative z-10 w-5 h-5" />
//                         <span className="relative z-10">Book Your Free Strategy Call</span>
//                         <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform" />
//                       </motion.a>

//                       {/* Urgency badge */}
//                       <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
//                         <div className="relative">
//                           <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
//                           <div className="absolute inset-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
//                         </div>
//                         <span className="text-sm font-semibold text-red-600 dark:text-red-400">
//                           Only {launchData.spotsLeft} spots left for {launchData.nextCohort}
//                         </span>
//                       </div>
//                     </motion.div>
//                   </div>

//                   {/* Right - Stats & Social Proof */}
//                   <div className="lg:col-span-2 flex flex-col justify-center">
//                     <motion.div
//                       initial={{ opacity: 0, x: 20 }}
//                       whileInView={{ opacity: 1, x: 0 }}
//                       viewport={{ once: true }}
//                       transition={{ delay: 0.5, duration: 0.6 }}
//                       className="space-y-4"
//                     >
//                       {/* Stats cards */}
//                       {urgencyStats.map((stat, i) => {
//                         const Icon = stat.icon;
//                         return (
//                           <motion.div
//                             key={stat.label}
//                             initial={{ opacity: 0, x: 20 }}
//                             whileInView={{ opacity: 1, x: 0 }}
//                             viewport={{ once: true }}
//                             transition={{ delay: 0.6 + i * 0.1 }}
//                             whileHover={{ x: 5 }}
//                             className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300"
//                           >
//                             <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10">
//                               <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
//                             </div>
//                             <div>
//                               <div className="text-xl font-bold text-gray-900 dark:text-white">
//                                 {stat.value}
//                               </div>
//                               <div className="text-sm text-gray-500 dark:text-gray-400">
//                                 {stat.label}
//                               </div>
//                             </div>
//                           </motion.div>
//                         );
//                       })}

//                       {/* Trust badge */}
//                       <motion.div
//                         initial={{ opacity: 0 }}
//                         whileInView={{ opacity: 1 }}
//                         viewport={{ once: true }}
//                         transition={{ delay: 0.9 }}
//                         className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border border-blue-200/50 dark:border-blue-500/20"
//                       >
//                         <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
//                         <div>
//                           <div className="text-sm font-semibold text-gray-900 dark:text-white">
//                             100% Free Consultation
//                           </div>
//                           <div className="text-xs text-gray-500 dark:text-gray-400">
//                             No commitments, no pressure
//                           </div>
//                         </div>
//                       </motion.div>
//                     </motion.div>
//                   </div>
//                 </div>
//               </div>

//               {/* Bottom contact bar */}
//               <div className="border-t border-gray-200 dark:border-gray-800 px-8 sm:px-10 lg:px-14 py-5 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
//                 <div className="flex items-center gap-2">
//                   <Mail className="w-4 h-4" />
//                   <span>hello@tbjgrowth.co.uk</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Phone className="w-4 h-4" />
//                   <span>+44 (0) 123 456 7890</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <MapPin className="w-4 h-4" />
//                   <span>London, UK</span>
//                 </div>
//               </div>
//             </div>
//           </motion.div>

//           {/* Bottom micro-CTA */}
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ delay: 0.8, duration: 0.5 }}
//             className="text-center mt-8"
//           >
//             <p className="text-sm text-gray-500 dark:text-gray-500">
//               Prefer to email?{" "}
//               <a
//                 href="mailto:hello@tbjgrowth.co.uk"
//                 className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
//               >
//                 Send us a message
//               </a>{" "}
//               and we'll get back to you within 24 hours.
//             </p>
//           </motion.div>
//         </div>
//       </motion.div>
//     </section>
//   );
// }














"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
    ArrowRight,
    Calendar,
    Sparkles,
    Mail,
} from "lucide-react";

export default function FinalCTA() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    // Parallax effects
    const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
    const imageY = useTransform(scrollYProgress, [0, 1], [0, -100]);
    const contentY = useTransform(scrollYProgress, [0, 0.5, 1], [80, 0, -80]);
    const overlayOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.6, 0.75, 0.9]);

    return (
        <section
            id="contact"
            ref={sectionRef}
            className="relative h-screen min-h-[600px] max-h-[300px] flex items-center justify-center overflow-hidden bg-[#0E0B0A]"
        >
            {/* Sticky Background Image with Parallax */}
            <motion.div
                ref={imageRef}
                style={{ scale: imageScale, y: imageY }}
                className="absolute inset-0 z-0"
            >
                {/* Replace with your actual image */}
                {/* Background Image */}
                <div className="absolute inset-0">
                    <Image
                        src="/cta-image.jpg"
                        alt="TBJ Growth Office"
                        fill
                        sizes="100vw"
                        className="object-cover"
                    />
                    {/* Grid overlay on top of image */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:80px_80px]" />
                </div>
            </motion.div>

            {/* Gradient Overlay */}
            <motion.div
                style={{ opacity: overlayOpacity }}
                className="absolute inset-0 z-10 bg-gradient-to-t from-[#0E0B0A] via-[#0E0B0A]/80 to-[#0E0B0A]/40"
            />

            {/* Content */}
            <motion.div
                style={{ y: contentY }}
                className="relative z-20 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto"
            >
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full mb-8"
                >
                    <Sparkles className="w-4 h-4 text-brand-orange-light" />
                    <span className="text-sm font-medium text-white/90">
                        Let's Build Something Great
                    </span>
                </motion.div>

                {/* Title */}
                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2, duration: 0.7 }}
                    className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-6 tracking-tight leading-tight"
                >
                    Ready to{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-orange-light via-brand-orange to-brand-orange-deep">
                        Scale
                    </span>
                    ?
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="text-lg sm:text-xl text-white/60 mb-12 max-w-xl mx-auto"
                >
                    Book a free strategy call and discover how we can help your business grow.
                </motion.p>

                {/* Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    {/* Primary CTA - Book a Conversation */}
                    <motion.a
                        href="#book-call"
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-orange-deep to-brand-orange text-white font-bold rounded-2xl overflow-hidden shadow-xl shadow-brand-orange/25 hover:shadow-2xl hover:shadow-brand-orange/40 transition-shadow duration-300"
                    >
                        {/* Shine effect */}
                        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />

                        <Calendar className="relative z-10 w-5 h-5" />
                        <span className="relative z-10 text-lg">Book a Conversation</span>
                        <ArrowRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </motion.a>

                    {/* Secondary CTA - Contact Us */}
                    <motion.a
                        href="mailto:hello@tbjgrowth.co.uk"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="group inline-flex items-center gap-2 px-8 py-4 border-2 border-white/20 text-white font-semibold rounded-2xl hover:bg-white/10 hover:border-white/40 transition-all duration-300 backdrop-blur-sm"
                    >
                        <Mail className="w-5 h-5" />
                        <span className="text-lg">Contact Us</span>
                    </motion.a>
                </motion.div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.5 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
            >
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex flex-col items-center gap-2 text-white/40"
                >
                    <span className="text-xs font-medium uppercase tracking-wider">Scroll</span>
                    <div className="w-5 h-8 rounded-full border-2 border-white/20 flex justify-center p-1">
                        <motion.div
                            animate={{ y: [0, 8, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full bg-white/40"
                        />
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
}