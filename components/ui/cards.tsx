// "use client";

// import { motion } from "framer-motion";
// import { cn } from "@/lib/utils";

// interface GlassCardProps {
//   children: React.ReactNode;
//   className?: string;
//   delay?: number;
// }

// export function GlassCard({ children, className, delay = 0 }: GlassCardProps) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 30 }}
//       whileInView={{ opacity: 1, y: 0 }}
//       viewport={{ once: true, margin: "-10% 0px" }}
//       transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9], delay }}
//       className={cn("glass-card p-8 relative overflow-hidden group", className)}
//     >
//       <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
//       {children}
//     </motion.div>
//   );
// }

// export function DashboardCard({ children, className, delay = 0 }: GlassCardProps) {
//   return (
//     <motion.div
//       initial={{ opacity: 0, scale: 0.95, rotateX: 10 }}
//       whileInView={{ opacity: 1, scale: 1, rotateX: 0 }}
//       viewport={{ once: true, margin: "-10% 0px" }}
//       transition={{ duration: 0.8, ease: "easeOut", delay }}
//       whileHover={{ y: -5, scale: 1.02 }}
//       className={cn(
//         "rounded-2xl bg-white dark:bg-charcoal border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden",
//         className
//       )}
//       style={{ perspective: 1000 }}
//     >
//       {children}
//     </motion.div>
//   );
// }
