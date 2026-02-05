"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { loadStrumWorklet } from "@/lib/loadWorklet";
import { createStrumNode } from "@/lib/createStrumNode";
import { encodeWAV } from "@/lib/utils";
import { Navbar } from "@/components/navbar";
import { CircularMicVisualizer } from "@/components/mic-visualizer";
import { Button } from "@/components/ui/button";
import { 
  Mic, 
  MicOff, 
  ChevronLeft, 
  Music, 
  CheckCircle2, 
  AlertCircle,
  Waves,
  Loader2
} from "lucide-react";

export default function AudioPage() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [rms, setRms] = useState(0);
  const [status, setStatus] = useState<"idle" | "starting" | "calibrating" | "listening" | "processing" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to listen");
  const [prediction, setPrediction] = useState<any>(null);
  const [showContent, setShowContent] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [threshold, setThreshold] = useState(0.02);

  // Calibration state
  const CALIBRATION_DURATION = 4000; // 4 seconds
  const CALIBRATION_SAMPLES = 80; // samples to collect
  const calibrationSamplesRef = useRef<number[]>([]);
  const baselineRmsRef = useRef<number>(0.02); // default threshold
  const SPIKE_MULTIPLIER = 4.0; // spike must be 4.0x the baseline (increased from 2.5 for noise immunity)
  const COOLDOWN_MS = 1200;
  const cooldownRef = useRef(false);
  const isCalibrating = useRef(false);

  // Animate content on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  async function start() {
    try {
      setStatus("starting");
      setStatusMessage("Initializing microphone...");
      setPrediction(null);
      setCalibrationProgress(0);
      calibrationSamplesRef.current = [];

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const ok = await loadStrumWorklet(audioContext);
      if (!ok) {
        setStatus("error");
        setStatusMessage("Failed to load audio worklet");
        return;
      }

      const node = createStrumNode(audioContext);
      nodeRef.current = node;

      node.port.onmessage = (event) => {
        const { type, rms, buffer } = event.data;

        if (type === "RMS") {
          setRms(rms);
          
          // During calibration, collect samples
          if (isCalibrating.current) {
            calibrationSamplesRef.current.push(rms);
            const progress = Math.min((calibrationSamplesRef.current.length / CALIBRATION_SAMPLES) * 100, 100);
            setCalibrationProgress(progress);
          } else {
            detectStrum(rms);
          }
        }

        if (type === "AUDIO_BUFFER" && buffer) {
          handleAudioBuffer(buffer as Float32Array);
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(node);

      setIsListening(true);
      
      // Start calibration
      setStatus("calibrating");
      setStatusMessage("Calibrating... Please stay quiet");
      isCalibrating.current = true;

      // Wait for calibration to complete
      setTimeout(() => {
        finishCalibration();
      }, CALIBRATION_DURATION);

    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Error accessing microphone");
    }
  }

  function finishCalibration() {
    isCalibrating.current = false;
    
    if (calibrationSamplesRef.current.length > 0) {
      // Calculate average RMS from calibration
      const avgRms = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
      // Set threshold as multiplier of average + higher minimum to avoid false triggers
      baselineRmsRef.current = Math.max(avgRms * SPIKE_MULTIPLIER, 0.05); // Increased min from 0.02 to 0.05
      setThreshold(baselineRmsRef.current);
      console.log(`Calibration complete. Baseline RMS: ${avgRms.toFixed(4)}, Detection Threshold: ${baselineRmsRef.current.toFixed(4)}`);
      
      // Send threshold to worklet
      nodeRef.current?.port.postMessage({ 
        type: "SET_THRESHOLD", 
        threshold: baselineRmsRef.current 
      });
    }
    
    setStatus("listening");
    setStatusMessage(`Listening for guitar strums...`);
    setCalibrationProgress(100);
  }

  function stop() {
    setIsListening(false);
    setStatus("idle");
    setStatusMessage("Ready to listen");
    isCalibrating.current = false;
    calibrationSamplesRef.current = [];
    setCalibrationProgress(0);

    nodeRef.current?.disconnect();
    nodeRef.current = null;

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function detectStrum(currentRms: number) {
    if (cooldownRef.current || isCalibrating.current) return;

    // Detect when spike ENDS (goes back below threshold)
    if (currentRms < baselineRmsRef.current && !cooldownRef.current) {
      // This indicates the spike has ended, capture the audio
      cooldownRef.current = true;
      
      setStatusMessage("Chord captured! Analyzing...");
      nodeRef.current?.port.postMessage({ type: "CAPTURE" });

      setTimeout(() => {
        cooldownRef.current = false;
        if (status === "listening") {
          setStatusMessage(`Listening for guitar strums...`);
        }
      }, COOLDOWN_MS);
    }
  }

  async function handleAudioBuffer(buffer: Float32Array) {
    setStatus("processing");
    setStatusMessage("Analyzing chord...");

    const sampleRate = audioContextRef.current!.sampleRate;
    const wavBlob = encodeWAV(buffer, sampleRate);

    const form = new FormData();
    form.append("file", wavBlob, "strum.wav");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/predict-audio`,
        { method: "POST", body: form }
      );

      const json = await res.json();
      setPrediction(json);
      setStatus("listening");
      setStatusMessage("Listening for guitar strums...");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Failed to analyze audio");
      setTimeout(() => {
        setStatus("listening");
        setStatusMessage("Listening for guitar strums...");
      }, 2000);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-neutral-950 pointer-events-none" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Navbar */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <Navbar />
      </motion.div>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-12">
        
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="absolute top-24 left-6"
        >
          <Link 
            href="/"
            className="group flex items-center gap-2 text-white/50 hover:text-white transition-all duration-300"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 group-hover:border-white/40 group-hover:bg-white/5 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </span>
            <span className="text-sm font-medium">Home</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30, filter: showContent ? "blur(0px)" : "blur(10px)" }}
          transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm bg-white/5 mb-6">
            <Waves className="w-4 h-4 text-[#C1e328]" />
            <span className="text-sm font-medium text-white/80">Audio Analysis</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight mb-4">
            Chord <span className="text-[#C1e328]">Detection</span>
          </h1>
          <p className="text-white/60 text-lg max-w-md mx-auto">
            Play a chord and let our AI identify it instantly
          </p>
        </motion.div>

        {/* Visualizer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0.9 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <CircularMicVisualizer rms={rms} isListening={isListening} />
        </motion.div>

        {/* Status Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-2 text-white/60">
            {status === "starting" && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === "calibrating" && <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />}
            {status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-[#C1e328]" />}
            {status === "listening" && <div className="w-2 h-2 rounded-full bg-[#C1e328] animate-pulse" />}
            {status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
            <span className={`${status === "error" ? "text-red-400" : status === "calibrating" ? "text-yellow-400" : ""}`}>
              {statusMessage}
            </span>
          </div>
          
          {/* Calibration Progress Bar */}
          {status === "calibrating" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 max-w-xs mx-auto"
            >
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-yellow-400 to-[#C1e328] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${calibrationProgress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-xs text-white/40 mt-2">
                Measuring background noise... {Math.round(calibrationProgress)}%
              </p>
            </motion.div>
          )}
          
          {/* RMS Level */}
          {isListening && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-xs text-white/40 font-mono"
            >
              Level: {(rms * 100).toFixed(1)}% {status === "listening" && `| Threshold: ${(threshold * 100).toFixed(1)}%`}
            </motion.div>
          )}
        </motion.div>

        {/* Control Button */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20, scale: showContent ? 1 : 0.95 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          {!isListening ? (
            <Button
              onClick={start}
              size="lg"
              className="px-10 py-6 text-lg rounded-full bg-[#C1e328] text-black hover:bg-[#d4f53d] transition-all duration-300 hover:scale-105 font-medium"
            >
              <Mic className="w-5 h-5 mr-3" />
              Start Listening
            </Button>
          ) : (
            <Button
              onClick={stop}
              size="lg"
              variant="outline"
              className="px-10 py-6 text-lg rounded-full border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 hover:scale-105 font-medium"
            >
              <MicOff className="w-5 h-5 mr-3" />
              Stop
            </Button>
          )}
        </motion.div>

        {/* Prediction Result */}
        <AnimatePresence mode="wait">
          {prediction && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mt-12 w-full max-w-md"
            >
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#C1e328]/20 flex items-center justify-center">
                    <Music className="w-6 h-6 text-[#C1e328]" />
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Detected Chord</p>
                    <p className="text-2xl font-bold text-white">{prediction.label}</p>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Confidence</span>
                    <span className="text-[#C1e328] font-mono">
                      {(prediction.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${prediction.confidence * 100}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full bg-gradient-to-r from-[#C1e328] to-[#9cb81c] rounded-full"
                    />
                  </div>
                </div>

                {/* Feedback */}
                {prediction.feedback && (
                  <div className="flex items-start gap-2 p-3 bg-[#C1e328]/10 rounded-lg border border-[#C1e328]/20">
                    <CheckCircle2 className="w-5 h-5 text-[#C1e328] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-white/80">{prediction.feedback}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showContent ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-24 text-center"
        >
          <p className="text-white/40 text-sm">
            Position your guitar near the microphone for best results
          </p>
        </motion.div>
      </main>
    </div>
  );
}
