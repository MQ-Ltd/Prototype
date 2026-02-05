"use client";
import { motion } from "framer-motion";

const TECHNOLOGIES = [
  "TensorFlow.js",
  "MediaPipe",
  "Web Audio API",
  "Next.js 14",
  "React Three Fiber",
  "Tailwind CSS",
  "Framer Motion",
  "YAMNet",
];

export function TechMarquee() {
  return (
    <div className="relative flex overflow-hidden py-8 bg-black border-y border-white/10 select-none">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10" />
      <motion.div
        className="flex gap-16 whitespace-nowrap"
        animate={{ x: "-50%" }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...TECHNOLOGIES, ...TECHNOLOGIES, ...TECHNOLOGIES].map((tech, i) => (
          <span
            key={i}
            className="text-lg font-mono text-white/20 uppercase tracking-[0.2em] font-medium"
          >
            {tech}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
