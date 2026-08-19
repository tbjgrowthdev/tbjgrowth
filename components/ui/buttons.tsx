// "use client";

// import { motion } from "framer-motion";
// import { useRef, useState } from "react";
// import { cn } from "@/lib/utils";

// interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
//   children: React.ReactNode;
// }

// export function MagneticButton({ children, className, ...props }: ButtonProps) {
//   const ref = useRef<HTMLButtonElement>(null);
//   const [position, setPosition] = useState({ x: 0, y: 0 });

//   const mouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
//     const { clientX, clientY } = e;
//     const { width, height, left, top } = ref.current!.getBoundingClientRect();
//     const x = clientX - (left + width / 2);
//     const y = clientY - (top + height / 2);
//     setPosition({ x, y });
//   };

//   const mouseLeave = () => {
//     setPosition({ x: 0, y: 0 });
//   };

//   return (
//     <motion.button
//       ref={ref}
//       onMouseMove={mouseMove}
//       onMouseLeave={mouseLeave}
//       animate={{ x: position.x * 0.2, y: position.y * 0.2 }}
//       transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
//       className={cn(
//         "relative overflow-hidden rounded-full bg-foreground text-background px-8 py-4 font-medium transition-colors hover:bg-emerald-deep hover:text-white dark:hover:bg-aurora dark:hover:text-black",
//         className
//       )}
//       {...props}
//     >
//       {children}
//     </motion.button>
//   );
// }

// export function GradientButton({ children, className, ...props }: ButtonProps) {
//   return (
//     <button
//       className={cn(
//         "relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium rounded-full group bg-gradient-to-br from-emerald-deep to-aurora group-hover:from-emerald-deep group-hover:to-aurora hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-emerald-200 dark:focus:ring-emerald-800",
//         className
//       )}
//       {...props}
//     >
//       <span className="relative px-8 py-4 transition-all ease-in-duration-75 bg-white dark:bg-gray-900 rounded-full group-hover:bg-opacity-0">
//         {children}
//       </span>
//     </button>
//   );
// }
