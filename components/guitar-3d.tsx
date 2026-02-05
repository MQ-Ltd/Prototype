"use client";

import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

export function Guitar3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
        const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
        setMousePosition({ x, y });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ 
        perspective: "1000px",
        transform: "translateY(-10%)"
      }}
    >
      <motion.div
        className="relative"
        style={{
          transformStyle: "preserve-3d",
          rotateY: mousePosition.x * 20,
          rotateX: -mousePosition.y * 20,
        }}
        animate={{
          rotateY: [0, 360],
        }}
        transition={{
          rotateY: {
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          },
        }}
      >
        {/* Guitar Body */}
        <div
          className="relative"
          style={{
            transformStyle: "preserve-3d",
            width: "400px",
            height: "500px",
          }}
        >
          {/* Guitar Body - Front (SVG for proper shape) */}
          <motion.svg
            className="absolute"
            style={{
              width: "320px",
              height: "380px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) translateZ(10px)",
            }}
            viewBox="0 0 320 380"
            animate={{
              filter: [
                "drop-shadow(0 0 40px rgba(255, 255, 255, 0.3))",
                "drop-shadow(0 0 50px rgba(255, 255, 255, 0.4))",
                "drop-shadow(0 0 40px rgba(255, 255, 255, 0.3))",
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <defs>
              <linearGradient id="guitarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2a2a2a" />
                <stop offset="100%" stopColor="#3a3a3a" />
              </linearGradient>
            </defs>
            {/* Guitar body path - figure 8 shape */}
            <path
              d="M 160 30 
                 C 190 30, 210 50, 220 80
                 C 230 110, 230 140, 220 170
                 C 210 200, 190 220, 160 220
                 C 130 220, 110 200, 100 170
                 C 90 140, 90 110, 100 80
                 C 110 50, 130 30, 160 30 Z
                 M 160 220
                 C 150 220, 140 230, 135 245
                 C 130 260, 130 275, 135 290
                 C 140 310, 150 330, 160 340
                 C 170 350, 180 350, 190 350
                 C 200 350, 210 340, 220 330
                 C 230 310, 235 290, 235 275
                 C 235 260, 230 245, 220 230
                 C 210 220, 200 220, 190 220
                 C 180 220, 170 220, 160 220 Z"
              fill="url(#guitarGradient)"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="3"
            />
          </motion.svg>

          {/* Guitar Body - Back */}
          <motion.svg
            className="absolute"
            style={{
              width: "320px",
              height: "380px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) translateZ(-10px)",
            }}
            viewBox="0 0 320 380"
          >
            <defs>
              <linearGradient id="guitarGradientBack" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#2a2a2a" />
              </linearGradient>
            </defs>
            <path
              d="M 160 30 
                 C 190 30, 210 50, 220 80
                 C 230 110, 230 140, 220 170
                 C 210 200, 190 220, 160 220
                 C 130 220, 110 200, 100 170
                 C 90 140, 90 110, 100 80
                 C 110 50, 130 30, 160 30 Z
                 M 160 220
                 C 150 220, 140 230, 135 245
                 C 130 260, 130 275, 135 290
                 C 140 310, 150 330, 160 340
                 C 170 350, 180 350, 190 350
                 C 200 350, 210 340, 220 330
                 C 230 310, 235 290, 235 275
                 C 235 260, 230 245, 220 230
                 C 210 220, 200 220, 190 220
                 C 180 220, 170 220, 160 220 Z"
              fill="url(#guitarGradientBack)"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2"
            />
          </motion.svg>

          {/* Sound Hole */}
          <motion.div
            className="absolute"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              border: "4px solid rgba(255, 255, 255, 0.5)",
              background: "radial-gradient(circle, #1a1a1a 0%, #2a2a2a 100%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) translateZ(15px)",
            }}
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.8, 1, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Neck */}
          <motion.div
            className="absolute"
            style={{
              width: "40px",
              height: "200px",
              background: "linear-gradient(90deg, #3a3a3a 0%, #2a2a2a 50%, #3a3a3a 100%)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%) translateZ(5px)",
              borderRadius: "20px 20px 0 0",
            }}
          />

          {/* Fretboard */}
          <motion.div
            className="absolute"
            style={{
              width: "35px",
              height: "200px",
              background: "linear-gradient(90deg, #2a2a2a 0%, #1a1a1a 50%, #2a2a2a 100%)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%) translateZ(8px)",
            }}
          />

          {/* Frets */}
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: "35px",
                height: "2px",
                background: "rgba(255, 255, 255, 0.6)",
                bottom: `${100 + (i + 1) * 30}%`,
                left: "50%",
                transform: "translateX(-50%) translateZ(9px)",
              }}
            />
          ))}

          {/* Strings */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: "2px",
                height: "200px",
                background: `linear-gradient(to bottom, 
                  rgba(255, 255, 255, ${0.8 - i * 0.1}) 0%,
                  rgba(255, 255, 255, ${0.6 - i * 0.08}) 50%,
                  rgba(255, 255, 255, ${0.4 - i * 0.06}) 100%)`,
                bottom: "100%",
                left: `${50 + (i - 2.5) * 4}%`,
                transform: "translateX(-50%) translateZ(10px)",
                boxShadow: "0 0 4px rgba(255, 255, 255, 0.6)",
              }}
              animate={{
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 1.5 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          ))}

          {/* Bridge */}
          <motion.div
            className="absolute"
            style={{
              width: "120px",
              height: "8px",
              background: "linear-gradient(90deg, #4a4a4a 0%, #3a3a3a 50%, #4a4a4a 100%)",
              border: "2px solid rgba(255, 255, 255, 0.4)",
              bottom: "20%",
              left: "50%",
              transform: "translateX(-50%) translateZ(12px)",
              borderRadius: "4px",
            }}
          />

          {/* Pick Guard */}
          <motion.div
            className="absolute"
            style={{
              width: "150px",
              height: "80px",
              background: "rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              bottom: "35%",
              left: "60%",
              transform: "translateZ(11px) rotate(-15deg)",
              borderRadius: "0 0 50% 0",
              clipPath: "polygon(0 0, 100% 0, 100% 70%, 0 100%)",
            }}
          />

          {/* Tuners */}
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "radial-gradient(circle, #5a5a5a 0%, #3a3a3a 100%)",
                border: "2px solid rgba(255, 255, 255, 0.5)",
                bottom: `${100 + 15}%`,
                left: `${50 + (i - 2.5) * 4}%`,
                transform: "translateX(-50%) translateZ(6px)",
                boxShadow: "0 0 6px rgba(255, 255, 255, 0.4)",
              }}
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 10 + i * 2,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.5,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

