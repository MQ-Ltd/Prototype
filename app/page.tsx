"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence, useMotionValueEvent } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { 
  ArrowRight, 
  Eye, 
  Mic,
  Brain,
  Play,
  Waves,
  ChevronUp,
  Music
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { Guitar3DModel } from "@/components/guitar-3d-model";
import { LoadingScreen } from "@/components/loading-screen";
import { AudioCard, VisionCard, NeuralCard } from "@/components/interactive-cards";
import { TechMarquee } from "@/components/tech-marquee";
import { BentoNav } from "@/components/bento-nav";
import { SiteFooter } from "@/components/site-footer";

// Module-level variable: persists across navigation, resets on refresh
let hasSeenLoading = false;

// Minimal feature item
function FeatureItem({ 
  icon: Icon, 
  title, 
  description, 
  delay = 0 
}: { 
  icon: any; 
  title: string; 
  description: string; 
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.6, 
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
      className="border border-white/20 rounded-lg p-8 hover:border-white/40 transition-all duration-300"
    >
      <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center mb-6">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLSectionElement>(null);
  const { scrollY, scrollYProgress } = useScroll();
  
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  // Parallax effects
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.95]);

  // Check module-level variable on mount
  useEffect(() => {
    if (hasSeenLoading) {
      setIsLoading(false);
      setShowContent(true);
      setHasLoadedOnce(true);
    }
  }, []);

  const handleLoadingComplete = () => {
    setIsLoading(false);
    setHasLoadedOnce(true);
    hasSeenLoading = true; // Set module-level flag
    setTimeout(() => setShowContent(true), 800);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {isLoading && (
          <LoadingScreen onLoadingComplete={handleLoadingComplete} />
        )}
      </AnimatePresence>

      <motion.main 
        className="w-full text-white bg-black relative"
      >
        {/* --- NAVBAR --- */}
        {/* Hidden on first load, then stays fixed at top */}
        {hasLoadedOnce && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-50"
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Navbar />
          </motion.div>
        )}
      
      {/* --- HERO SECTION --- */}
      {/* Changed min-h-screen to h-screen to force exact viewport height */}
      <motion.section 
        ref={heroRef}
        style={{ opacity: heroOpacity }}
        className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-6"
      >
        {/* 3D Guitar Model */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(12px)" }}
          animate={{ 
            opacity: !isLoading ? 1 : 0, 
            filter: !isLoading ? "blur(0px)" : "blur(12px)" 
          }}
          transition={{ 
            duration: 2.4, 
            ease: [0.22, 1, 0.36, 1],
            delay: 0 
          }}
          className="absolute inset-0 z-0 pointer-events-none" 
        >
          <Guitar3DModel />
        </motion.div>

        {/* Main Content Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showContent ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="max-w-4xl mx-auto text-center space-y-12 relative z-10 mt-10" // Added mt-10 to visually center vertically better
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20, filter: showContent ? "blur(0px)" : "blur(10px)" }}
            transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/30 backdrop-blur-sm bg-black/20"
          >
            <span className="text-sm font-medium">Machine Learning & Neural Networks</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[1.1]"
          >
            <motion.span
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 40, filter: showContent ? "blur(0px)" : "blur(12px)" }}
              transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="block"
            >
              Real-time feedback
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 40, filter: showContent ? "blur(0px)" : "blur(12px)" }}
              transition={{ duration: 1.4, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="block font-normal"
            >
              for guitar practice
            </motion.span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20, filter: showContent ? "blur(0px)" : "blur(8px)" }}
            transition={{ delay: 0.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed"
          >
            Machine learning and neural networks analyze your audio and hand position 
            to provide instant, accurate feedback on every chord.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(8px)", scale: 0.95 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20, filter: showContent ? "blur(0px)" : "blur(8px)", scale: showContent ? 1 : 0.95 }}
            transition={{ delay: 1.0, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="pt-8 pb-20"
          >
            <button
              onClick={() => bentoRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-base px-8 py-6 border-2 border-white bg-transparent text-white hover:bg-white hover:text-black transition-all duration-500 rounded-full font-medium hover:scale-105 inline-flex items-center gap-2"
            >
              <Play className="h-5 w-5" />
              Start Practicing
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : -10 }}
          transition={{ delay: 1.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 cursor-pointer"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center bg-black/20 backdrop-blur-sm"
          >
            <ChevronUp className="w-5 h-5 rotate-180" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto py-32 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-light mb-4 tracking-tight">
            How It Works
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Three technologies working together in real-time
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <AudioCard />
          <VisionCard />
          <NeuralCard />
        </div>
      </section>

      {/* Tech Marquee */}
      <TechMarquee />

      {/* Big Statement Section (Optional, adds drama) */}
      <section className="relative z-10 px-6 py-32 bg-black overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            Practice smarter,<br/>
            <span className="text-[#C1e328]">not harder.</span>
          </h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            MusiQ sees what you play and hears how you play it, giving you the feedback loop you need to master your instrument.
          </p>
        </div>
      </section>

      {/* Bento Navigation */}
      <BentoNav ref={bentoRef} />

      {/* Bento Grid Section */}
      <section className="relative z-10 px-6 max-w-7xl mx-auto py-16 border-t border-white/10 bg-black">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-light mb-4 tracking-tight">
            Explore Musi<span className="text-[#C1e328]">Q</span>
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Everything you need to perfect your guitar practice
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[220px]">
          {/* Product Overview - Large */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-2 md:row-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300"
          >
            <h3 className="text-3xl font-semibold mb-4 text-white">MusiQ</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              Machine learning-powered guitar practice companion. Real-time feedback on strums, hand positioning, and chord recognition using cutting-edge neural networks.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs px-3 py-1 rounded-full bg-[#C1e328]/10 text-[#C1e328] border border-[#C1e328]/30">ML</span>
              <span className="text-xs px-3 py-1 rounded-full bg-[#C1e328]/10 text-[#C1e328] border border-[#C1e328]/30">Audio</span>
              <span className="text-xs px-3 py-1 rounded-full bg-[#C1e328]/10 text-[#C1e328] border border-[#C1e328]/30">Vision</span>
            </div>
          </motion.div>

          {/* Audio Mode */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-[#C1e328]/30 transition-all duration-300 cursor-pointer hover:bg-white/10"
          >
            <Link href="/audio" className="h-full flex flex-col justify-between">
              <div>
                <Mic className="w-8 h-8 text-[#C1e328] mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Audio Mode</h3>
              </div>
              <p className="text-white/60 text-sm">Real-time strum detection</p>
            </Link>
          </motion.div>

          {/* Vision Mode */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-blue-400/30 transition-all duration-300 cursor-pointer hover:bg-white/10"
          >
            <Link href="/vision" className="h-full flex flex-col justify-between">
              <div>
                <Eye className="w-8 h-8 text-blue-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Vision Mode</h3>
              </div>
              <p className="text-white/60 text-sm">Hand tracking analysis</p>
            </Link>
          </motion.div>

          {/* Combined Mode - Large */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300 cursor-pointer hover:bg-white/10"
          >
            <Link href="/combined" className="h-full flex flex-col justify-between">
              <div>
                <Music className="w-8 h-8 text-[#C1e328] mb-4" />
                <h3 className="text-2xl font-semibold text-white mb-2">Combined Mode</h3>
              </div>
              <p className="text-white/60 text-sm">Full experience with audio and vision analysis for complete feedback</p>
            </Link>
          </motion.div>

          {/* About Section */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Built By</h3>
            <div className="space-y-3">
              <div>
                <p className="text-white text-sm font-medium">Chiranjeev Rout</p>
                <p className="text-white/60 text-xs">Co-founder</p>
              </div>
              <div>
                <p className="text-white text-sm font-medium">Satyam Subham</p>
                <p className="text-white/60 text-xs">Co-founder</p>
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Get in Touch</h3>
            <p className="text-white/60 text-sm mb-3">Have questions?</p>
            <a href="mailto:csproduction100@gmail.com" className="inline-block">
              <span className="text-[#C1e328] text-sm hover:underline">csproduction100@gmail.com</span>
            </a>
          </motion.div>

          {/* Status */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#C1e328] animate-pulse" />
              <h3 className="text-xl font-semibold text-white">Live</h3>
            </div>
            <p className="text-white/60 text-sm">Currently in development</p>
          </motion.div>
        </div>
      </section>

      

      {/* Footer */}
      <SiteFooter />
    </motion.main>
    </>
  );
}