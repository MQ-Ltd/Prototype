"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface MicVisualizerProps {
  rms: number;
  isListening: boolean;
}

// Creates an animated waveform visualization based on microphone input
export function MicVisualizer({ rms, isListening }: MicVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(32).fill(0.1));
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isListening) {
      setBars(Array(32).fill(0.1));
      return;
    }

    const animate = () => {
      setBars(prev => prev.map((_, i) => {
        // Create wave-like pattern based on RMS
        const baseHeight = Math.min(rms * 8, 1);
        const variation = Math.sin(Date.now() / 100 + i * 0.5) * 0.3;
        const randomness = Math.random() * 0.2;
        return Math.max(0.1, Math.min(1, baseHeight + variation + randomness));
      }));
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, rms]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Glow effect behind visualizer */}
      <motion.div
        animate={{
          opacity: isListening ? [0.3, 0.6, 0.3] : 0,
          scale: isListening ? [1, 1.05, 1] : 1,
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[#C1e328]/20 blur-3xl rounded-full"
      />

      {/* Main visualizer container */}
      <div className="relative flex items-end justify-center gap-1 h-48 px-4">
        {bars.map((height, i) => (
          <motion.div
            key={i}
            className="w-2 rounded-full"
            style={{
              background: isListening 
                ? `linear-gradient(to top, #C1e328, #ffffff)` 
                : 'rgba(255,255,255,0.2)',
            }}
            animate={{
              height: `${height * 100}%`,
              opacity: isListening ? 0.8 + height * 0.2 : 0.3,
            }}
            transition={{
              duration: 0.05,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Center circle indicator */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        animate={{
          scale: isListening ? [1, 1.1, 1] : 1,
          opacity: isListening ? 1 : 0.5,
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div 
          className="w-24 h-24 rounded-full border-2 flex items-center justify-center"
          style={{ 
            borderColor: isListening ? '#C1e328' : 'rgba(255,255,255,0.3)',
            boxShadow: isListening ? '0 0 30px rgba(193, 227, 40, 0.3)' : 'none'
          }}
        >
          <motion.div
            animate={{ scale: isListening ? [0.8, 1, 0.8] : 0.8 }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: isListening ? '#C1e328' : 'rgba(255,255,255,0.5)' }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// Circular wave visualizer alternative
export function CircularMicVisualizer({ rms, isListening }: MicVisualizerProps) {
  const [waves, setWaves] = useState<number[]>([]);
  
  useEffect(() => {
    if (!isListening) {
      setWaves([]);
      return;
    }

    const interval = setInterval(() => {
      if (rms > 0.02) {
        setWaves(prev => [...prev.slice(-5), Date.now()]);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isListening, rms]);

  return (
    <div className="relative w-80 h-80 mx-auto">
      {/* Ripple waves */}
      {waves.map((id) => (
        <motion.div
          key={id}
          className="absolute inset-0 rounded-full border-2 border-[#C1e328]"
          initial={{ scale: 0.3, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      ))}

      {/* Center mic icon area */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: isListening ? [1, 1.05, 1] : 1,
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        <div 
          className="w-32 h-32 rounded-full border-4 flex items-center justify-center backdrop-blur-sm"
          style={{ 
            borderColor: isListening ? '#C1e328' : 'rgba(255,255,255,0.3)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            boxShadow: isListening ? '0 0 60px rgba(193, 227, 40, 0.4)' : 'none'
          }}
        >
          {/* Mic SVG */}
          <motion.svg 
            width="48" 
            height="48" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke={isListening ? '#C1e328' : 'rgba(255,255,255,0.5)'} 
            strokeWidth="2"
            animate={{ scale: isListening ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </motion.svg>
        </div>
      </motion.div>

      {/* RMS level indicator ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
        />
        <motion.circle
          cx="50%"
          cy="50%"
          r="45%"
          fill="none"
          stroke="#C1e328"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * 2 * 144}`}
          animate={{
            strokeDashoffset: Math.PI * 2 * 144 * (1 - Math.min(rms * 10, 1)),
          }}
          transition={{ duration: 0.1 }}
        />
      </svg>
    </div>
  );
}
