// "use client";

// import { motion, useInView } from "framer-motion";
// import { useRef } from "react";
// import { cn } from "@/lib/utils";

// interface AnimatedTextProps {
//   text: string;
//   className?: string;
//   as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
//   delay?: number;
// }

// export function AnimatedHeading({ text, className, as: Component = "h2", delay = 0 }: AnimatedTextProps) {
//   const ref = useRef(null);
//   const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

//   const defaultAnimations = {
//     hidden: { opacity: 0, y: 50, filter: "blur(10px)" },
//     visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9], delay } },
//   };

//   return (
//     <Component ref={ref} className={cn("overflow-hidden", className)}>
//       <motion.span
//         initial="hidden"
//         animate={isInView ? "visible" : "hidden"}
//         variants={defaultAnimations}
//         className="inline-block"
//       >
//         {text}
//       </motion.span>
//     </Component>
//   );
// }

// export function AnimatedParagraph({ text, className, delay = 0 }: AnimatedTextProps) {
//   const ref = useRef(null);
//   const isInView = useInView(ref, { once: true, margin: "-10% 0px" });

//   const defaultAnimations = {
//     hidden: { opacity: 0, y: 20 },
//     visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", delay } },
//   };

//   return (
//     <p ref={ref} className={cn("", className)}>
//       <motion.span
//         initial="hidden"
//         animate={isInView ? "visible" : "hidden"}
//         variants={defaultAnimations}
//         className="inline-block"
//       >
//         {text}
//       </motion.span>
//     </p>
//   );
// }

// export function AnimatedWordText({ text, className, delay = 0 }: AnimatedTextProps) {
//   const ref = useRef(null);
//   const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
  
//   const words = text.split(" ");
  
//   const container = {
//     hidden: { opacity: 0 },
//     visible: (i = 1) => ({
//       opacity: 1,
//       transition: { staggerChildren: 0.08, delayChildren: delay * i },
//     }),
//   };

//   const child = {
//     visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", damping: 12, stiffness: 100 } },
//     hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
//   };

//   return (
//     <motion.div
//       ref={ref}
//       style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}
//       className={className}
//       variants={container}
//       initial="hidden"
//       animate={isInView ? "visible" : "hidden"}
//     >
//       {words.map((word, index) => (
//         <motion.span variants={child} style={{ marginRight: "0.25em" }} key={index}>
//           {word}
//         </motion.span>
//       ))}
//     </motion.div>
//   );
// }
