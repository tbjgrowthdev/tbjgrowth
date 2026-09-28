"use client";

import { motion } from "framer-motion";

/** Soft radiating morning-sun rays, sat behind the hero headline. */
export function Sunburst({ className = "" }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i);
  return (
    <div className={`pointer-events-none ${className}`}>
      <motion.svg
        viewBox="0 0 400 400"
        className="w-full h-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E3A857" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#E3A857" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="190" fill="url(#sunGlow)" />
        {rays.map((i) => {
          const angle = (i / rays.length) * 360;
          return (
            <rect
              key={i}
              x="198.5"
              y="20"
              width="3"
              height={i % 2 === 0 ? "70" : "40"}
              rx="1.5"
              fill="#C6862B"
              opacity={i % 2 === 0 ? 0.35 : 0.2}
              transform={`rotate(${angle} 200 200)`}
            />
          );
        })}
      </motion.svg>
    </div>
  );
}

/** Scattered warm sparkle motes — a light-mode stand-in for the old night stars. */
export function SparkleDust({ count = 20, className = "" }: { count?: number; className?: string }) {
  const dots = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 41) % 100}%`,
    top: `${(i * 29) % 100}%`,
    size: 2 + ((i * 13) % 3),
    delay: (i % 8) * 0.35,
    duration: 3 + (i % 4) * 0.7,
  }));

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {dots.map((dot) => (
        <motion.span
          key={dot.id}
          className="absolute rounded-full bg-[#E3A857]"
          style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size }}
          animate={{ opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: dot.duration, repeat: Infinity, delay: dot.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Layered palm-grove silhouette for a section's bottom edge, tuned for a light backdrop. */
export function PalmSilhouette({ className = "", fill = "#F5E6CB" }: { className?: string; fill?: string }) {
  return (
    <svg
      viewBox="0 0 1440 220"
      className={`pointer-events-none w-full ${className}`}
      preserveAspectRatio="none"
    >
      <path
        d="M0,220 L0,140 C120,150 200,60 260,20 C230,60 220,110 240,150 C270,100 320,50 360,15 C330,70 325,120 345,160 C390,100 420,70 460,45 C440,90 445,130 470,165 C520,110 560,90 610,75 C590,110 595,145 620,175 C700,130 780,150 860,175 C900,145 895,110 875,75 C925,90 965,110 1015,165 C1040,130 1035,90 1015,45 C1055,70 1085,100 1115,160 C1135,120 1130,70 1100,15 C1140,50 1190,100 1220,150 C1240,110 1230,60 1200,20 C1260,60 1340,150 1440,140 L1440,220 Z"
        fill={fill}
      />
    </svg>
  );
}

/** A thin dotted connector line used along the harvest-process timeline. */
export function DottedPath({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 4 200" className={`pointer-events-none ${className}`} preserveAspectRatio="none">
      <line
        x1="2"
        y1="0"
        x2="2"
        y2="200"
        stroke="#C6862B"
        strokeWidth="2"
        strokeDasharray="2 10"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
