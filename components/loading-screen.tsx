"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";

// 1. Main Brand Font (Logo)
const inter = Inter({ subsets: ["latin"], weight: ["800"] });

// 2. Professional Tech Font (Loader)
// JetBrains Mono is clean, legible, and premium code-style.
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

// --- CONFIGURATION ---
const SHIMMER_DURATION = 2; 
const TOTAL_PASSES = 2;       
const TOTAL_TIME_MS = SHIMMER_DURATION * TOTAL_PASSES * 1000; 

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const updateInterval = TOTAL_TIME_MS / 100; 

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsLoaded(true);
          setTimeout(() => onLoadingComplete(), 1000); 
          return 100;
        }
        return prev + 1;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [onLoadingComplete]);

  return (
    <div className={`fixed inset-0 z-[100] bg-black text-white ${inter.className}`}>
      
      {/* --- LOGO (Positioned at Top 40%) --- */}
      <div className="absolute top-[40%] left-0 w-full flex justify-center -translate-y-1/2 pointer-events-none">
        <div className="relative">
          {/* Layer 1: Dark Grey Base */}
          <div className="relative z-10 flex text-8xl md:text-9xl font-extrabold tracking-tighter select-none text-neutral-800">
            <span>Musi</span>
            <span className="text-neutral-800">Q</span>
          </div>

          {/* Layer 2: Shimmer Mask */}
          {/**
           * Framer Motion's TS types don't include vendor-specific CSS keys.
           * Use pre-typed objects (`as any`) to avoid red squiggles while keeping animation.
           */}
          <motion.div
            className="absolute inset-0 z-20 flex text-8xl md:text-9xl font-extrabold tracking-tighter select-none"
            initial={{ WebkitMaskPosition: "100% 0", maskPosition: "100% 0" } as any}
            animate={
              (isLoaded
                ? {
                    WebkitMaskPosition: "0% 0",
                    WebkitMaskImage: "linear-gradient(to right, black, black)",
                    maskImage: "linear-gradient(to right, black, black)",
                  }
                : {
                    WebkitMaskPosition: ["150% 0", "-50% 0"],
                    maskPosition: ["150% 0", "-50% 0"],
                  }) as any
            }
            transition={
              isLoaded
                ? { duration: 0.5 }
                : { duration: SHIMMER_DURATION, repeat: Infinity, ease: "linear" }
            }
            style={{
              WebkitMaskImage:
                "linear-gradient(60deg, transparent 40%, black 50%, transparent 60%)",
              maskImage:
                "linear-gradient(60deg, transparent 40%, black 50%, transparent 60%)",
              WebkitMaskSize: "250% 100%",
              maskSize: "250% 100%",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            } as any}
          >
            <span className="text-white">Musi</span>
            <span className="text-[#C1e328]">Q</span>
          </motion.div>
        </div>
      </div>

      {/* --- BOTTOM: Professional Mono Loader --- */}
      <motion.div 
        className={`absolute bottom-12 left-0 w-full flex justify-center items-center ${mono.className}`}
        animate={{ opacity: isLoaded ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-3">
            {/* The Percentage */}
            {/* tabular-nums ensures the numbers don't jitter left/right as they change width */}
            <div className="text-sm font-medium tracking-widest text-white tabular-nums">
                {Math.floor(progress)}%
            </div>
            
            {/* Minimal Status Bar (Optional, keeps it anchored) */}
            <div className="w-24 h-[1px] bg-neutral-800 overflow-hidden relative">
                 <motion.div 
                    className="absolute top-0 left-0 h-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.1 }}
                 />
            </div>

            {/* Subtext */}
            <div className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] opacity-60">
    
                <span className="font-mono">© 2025 MusiQ Project. All rights reserved.</span>
            </div>
        </div>
      </motion.div>

    </div>
  );
}