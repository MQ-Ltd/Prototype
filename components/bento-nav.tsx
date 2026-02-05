"use client";

import Link from "next/link";
import { useEffect, useState, forwardRef, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Mic, Eye, Music, BookOpen, Focus } from "lucide-react";

export const BentoNav = forwardRef<HTMLSectionElement>((props, ref) => {
  const [barHeights, setBarHeights] = useState<number[]>([25, 60, 40, 75]);
  useEffect(() => {
    setBarHeights(Array.from({ length: 4 }, () => Math.floor(Math.random() * 80) + 20));
  }, []);
  return (
    <section ref={ref} className="px-6 max-w-7xl mx-auto py-24">
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 h-auto md:h-[500px]">
        {/* BIG TILE (2x2): Combined Mode */}
        <Link
          href="/combined"
          className="col-span-1 md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/10"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#C1e328]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <div className="p-4">
                <Music className="w-8 h-8 text-[#C1e328]" />
              </div>
              <motion.div
                className="w-6 h-6"
                whileHover={{ rotate: 45 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
              >
                <ArrowUpRight className="w-6 h-6 text-white/40 group-hover:text-white" />
              </motion.div>
            </div>
            <div>
              <h3 className="text-3xl font-bold mb-2 text-white">Combined Experience</h3>
              <p className="text-white/60 max-w-sm">
                The ultimate practice tool. Fusing computer vision and audio DSP for complete performance analysis.
              </p>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#C1e328] blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
        </Link>

        {/* TALL TILE (1x2): Vision Mode */}
        <Link
          href="/vision"
          className="col-span-1 md:col-span-1 md:row-span-2 group relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/10 hover:border-blue-500/50 transition-colors duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <Eye className="w-6 h-6 text-blue-400" />
              <motion.div
                whileHover={{ rotate: -10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
              >
                <motion.div
                  animate={{ y: [0, 2, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Focus className="w-6 h-6 text-white" />
                </motion.div>
              </motion.div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-1 text-blue-400">Vision Only</h3>
              <p className="text-white/50 text-xs leading-relaxed">
                Focus strictly on hand posture and finger placement mechanics.
              </p>
            </div>
          </div>
        </Link>

        {/* WIDE TILE (1x1): Audio Mode */}
        <Link
          href="/audio"
          className="col-span-1 md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl bg-neutral-900 border border-white/10 hover:border-purple-500/50 transition-colors duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
            <div className="flex justify-between items-start">
              <Mic className="w-6 h-6 text-purple-400" />
              <div className="flex gap-0.5 items-end h-6">
                {barHeights.map((h, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-purple-500/60 rounded-full origin-bottom"
                    style={{ height: `${h}%` }}
                    animate={{ height: [
                      `${Math.max(8, Math.round(h * 0.6))}%`,
                      `${Math.min(100, Math.round(h * 1.1))}%`,
                      `${Math.max(8, Math.round(h * 0.6))}%`,
                    ] }}
                    transition={{ duration: 1.4 + i * 0.12, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </div>
            </div>
            <h3 className="text-lg font-bold text-white">Audio Mode</h3>
          </div>
        </Link>

        {/* SMALL TILE (1x1): Docs */}
        <Link
          href="/docs"
          className="col-span-1 md:col-span-1 md:row-span-1 group relative overflow-hidden rounded-3xl bg-white/3 text-white/90 flex flex-col items-center justify-center gap-2 hover:scale-[0.98] transition-transform duration-300"
        >
          <div className="p-4 bg-white/5 rounded-full">
            <BookOpen className="w-8 h-8 text-white/80" />
          </div>
          <span className="font-semibold text-sm flex items-center gap-1">
            Docs
          </span>
        </Link>
      </div>
    </section>
  );
});
