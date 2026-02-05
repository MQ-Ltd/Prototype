"use client";

import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { Waves, Eye, Brain } from "lucide-react";

// 3D Tilt Card Wrapper with Parallax Depth
interface ThreeDCardProps {
  children: ReactNode;
  href: string;
  glowColor?: string;
}

function ThreeDCard({ children, href, glowColor = "255, 255, 255" }: ThreeDCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position relative to card center
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth spring animations
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), {
    stiffness: 150,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 150,
    damping: 20,
  });

  // Spotlight position
  const spotlightX = useSpring(useTransform(mouseX, [-0.5, 0.5], [0, 100]), {
    stiffness: 100,
    damping: 20,
  });
  const spotlightY = useSpring(useTransform(mouseY, [-0.5, 0.5], [0, 100]), {
    stiffness: 100,
    damping: 20,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Normalize to -0.5 to 0.5
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setIsHovered(false);
  };

  return (
    <Link href={href}>
      <motion.div
        ref={cardRef}
        className="relative h-full"
        style={{
          perspective: "1200px",
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <motion.div
          className="relative h-full rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 cursor-pointer"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          whileHover={{
            scale: 1.02,
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Dynamic Spotlight */}
          <motion.div
            className="absolute inset-0 opacity-0 pointer-events-none"
            style={{
              background: `radial-gradient(600px circle at ${spotlightX.get() + 50}% ${spotlightY.get() + 50}%, rgba(${glowColor}, 0.15), transparent 40%)`,
            }}
            animate={{
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Content with preserve-3d for children to pop out */}
          <div style={{ transformStyle: "preserve-3d" }}>
            {children}
          </div>

          {/* Border glow on hover */}
          <motion.div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              boxShadow: `0 0 40px rgba(${glowColor}, 0.2)`,
              opacity: 0,
            }}
            animate={{
              opacity: isHovered ? 1 : 0,
            }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      </motion.div>
    </Link>
  );
}

// Simplex noise implementation for audio visualizer
class SimplexNoise {
  private grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  private p: number[];
  private perm: number[];
  
  constructor() {
    this.p = [];
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(Math.random() * 256);
    }
    this.perm = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }
  
  dot(g: number[], x: number, y: number) {
    return g[0] * x + g[1] * y;
  }
  
  noise(xin: number, yin: number) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]] % 12;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    let n0 = 0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    let n1 = 0;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    let n2 = 0;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }
    return 70.0 * (n0 + n1 + n2);
  }
}

// Audio Card - Live Simplex Noise Visualizer
export function AudioCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const noiseRef = useRef(new SimplexNoise());
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 128 * dpr;
    ctx.scale(dpr, dpr);

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, 300, 128);
      
      const bars = 32;
      const barWidth = 300 / bars;
      const intensity = isHovered ? 1.6 : 0.7;
      
      for (let i = 0; i < bars; i++) {
        const x = i * barWidth;
        const noise = noiseRef.current.noise(i * 0.1, timeRef.current * 0.5);
        const height = (noise + 1) * 32 * intensity + 12;
        
        const gradient = ctx.createLinearGradient(0, 128 - height, 0, 128);
        gradient.addColorStop(0, "#C1e328");
        gradient.addColorStop(1, "rgba(193, 227, 40, 0.3)");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 128 - height, barWidth - 2, height);
      }
      
      timeRef.current += isHovered ? 0.08 : 0.03;
      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isHovered]);

  return (
    <ThreeDCard href="/audio" glowColor="193, 227, 40">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Icon - Pops out 75px */}
        <div 
          className="w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center mb-6 transition-all duration-500 bg-black/30"
          style={{ transform: "translateZ(75px)" }}
        >
          <Waves className="w-7 h-7 text-[#C1e328]" />
        </div>

        {/* Title & Description */}
        <h3 className="text-2xl font-semibold mb-3 text-white/90" style={{ transform: "translateZ(40px)" }}>Audio Analysis</h3>
        <p className="text-white/60 text-sm leading-relaxed mb-6" style={{ transform: "translateZ(20px)" }}>
          Real-time DSP engine with Simplex noise algorithms detect strums with millisecond precision.
        </p>

        {/* Live Canvas Visualizer - Pops out in Z-space */}
        <div 
          className="relative h-32 rounded-xl bg-black/40 border border-[#C1e328]/30 shadow-[0_0_20px_rgba(193,227,40,0.2)] overflow-visible"
          style={{ transform: "translateZ(50px)" }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-xl"
            style={{ width: "100%", height: "128px", transform: "translateZ(10px)" }}
          />
        </div>
      </div>
    </ThreeDCard>
  );
}

// Vision Card - Lens Focus Effect
export function VisionCard() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <ThreeDCard href="/vision" glowColor="147, 197, 253">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Lens Focus Effect */}
        {isHovered && (
          <motion.div
            className="absolute pointer-events-none z-30"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              width: 150,
              height: 150,
              marginLeft: -75,
              marginTop: -75,
              background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
              border: "2px solid rgba(255,255,255,0.4)",
              borderRadius: "50%",
              boxShadow: "0 0 40px rgba(255,255,255,0.3), inset 0 0 30px rgba(255,255,255,0.15)",
              transform: "translateZ(100px)",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {/* Content */}
        <div className="relative z-10" style={{ transformStyle: "preserve-3d" }}>
          {/* Icon - Pops out 75px */}
          <div 
            className="w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center mb-6 transition-all duration-500 bg-black/30"
            style={{ transform: "translateZ(75px)" }}
          >
            <Eye className="w-7 h-7 text-blue-400" />
          </div>

          <h3 className="text-2xl font-semibold mb-3 text-white/90" style={{ transform: "translateZ(40px)" }}>Vision Tracking</h3>
          <p className="text-white/60 text-sm leading-relaxed mb-6" style={{ transform: "translateZ(20px)" }}>
            MediaPipe hand landmark detection with sub-pixel accuracy for precise finger position analysis.
          </p>

          {/* Visual representation - Pops out in Z-space */}
          <div 
            className="relative h-32 rounded-xl bg-black/40 border border-blue-400/30 shadow-[0_0_20px_rgba(147,197,253,0.2)] flex items-center justify-center overflow-visible"
            style={{ transform: "translateZ(50px)" }}
          >
            <motion.div
              animate={{
                scale: isHovered ? [1, 1.15, 1] : 1,
                opacity: isHovered ? [0.6, 0.9, 0.6] : 0.4,
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-20 h-20 rounded-full border-4 border-blue-400/50"
              style={{ transform: "translateZ(20px)" }}
            />
            <motion.div
              animate={{
                scale: isHovered ? [1, 1.25, 1] : 1,
                opacity: isHovered ? [0.4, 0.7, 0.4] : 0.3,
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              className="absolute w-32 h-32 rounded-full border-2 border-blue-400/30"
            />
          </div>
        </div>
      </div>
    </ThreeDCard>
  );
}

// Neural Network Card - Particle Network
export function NeuralCard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number }>>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 300 * dpr;
    canvas.height = 128 * dpr;
    ctx.scale(dpr, dpr);

    // Initialize particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 28; i++) {
        particlesRef.current.push({
          x: Math.random() * 300,
          y: Math.random() * 128,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
        });
      }
    }

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, 300, 128);

      // Update particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges
        if (p.x < 0 || p.x > 300) p.vx *= -1;
        if (p.y < 0 || p.y > 128) p.vy *= -1;

        // Attract to mouse when hovered
        if (isHovered) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 0) {
            p.vx += (dx / dist) * 0.05;
            p.vy += (dy / dist) * 0.05;
          }
        }

        // Damping
        p.vx *= 0.98;
        p.vy *= 0.98;
      });

      // Draw connections
      ctx.strokeStyle = "rgba(193, 227, 40, 0.2)";
      ctx.lineWidth = 1;
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const p1 = particlesRef.current[i];
          const p2 = particlesRef.current[j];
          const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          if (dist < 80) {
            ctx.globalAlpha = 1 - dist / 80;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#C1e328";
      particlesRef.current.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 300,
      y: ((e.clientY - rect.top) / rect.height) * 128,
    };
  };

  return (
    <ThreeDCard href="/combined" glowColor="193, 227, 40">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Icon - Pops out 75px */}
        <div 
          className="w-14 h-14 rounded-2xl border-2 border-white/20 flex items-center justify-center mb-6 transition-all duration-500 bg-black/30"
          style={{ transform: "translateZ(75px)" }}
        >
          <Brain className="w-7 h-7 text-[#C1e328]" />
        </div>

        {/* Title & Description */}
        <h3 className="text-2xl font-semibold mb-3 text-white/90" style={{ transform: "translateZ(40px)" }}>Neural Networks</h3>
        <p className="text-white/60 text-sm leading-relaxed mb-6" style={{ transform: "translateZ(20px)" }}>
          YAMNet deep learning models fuse audio and visual data for multi-modal chord recognition.
        </p>

        {/* Particle Network Canvas - Pops out in Z-space */}
        <div 
          className="relative h-32 rounded-xl bg-black/40 border border-[#C1e328]/30 shadow-[0_0_20px_rgba(193,227,40,0.2)] overflow-visible"
          onMouseMove={handleMouseMove}
          style={{ transform: "translateZ(50px)" }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-xl"
            style={{ width: "100%", height: "128px", transform: "translateZ(10px)" }}
          />
        </div>
      </div>
    </ThreeDCard>
  );
}
