"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { loadStrumWorklet } from "@/lib/loadWorklet";
import { createStrumNode } from "@/lib/createStrumNode";
import { encodeWAV } from "@/lib/utils";
import { 
  Eye,
  ChevronLeft,
  Loader2,
  Hand,
  Target,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  X,
  Mic,
  MicOff,
  Volume2,
  Music
} from "lucide-react";

// Finger landmark indices (MediaPipe)
const FINGER_MAP: { [key: string]: number } = {
  index: 8, im: 6,
  middle: 12, mm: 10,
  ring: 16, rm: 14,
  pinky: 20, pm: 18,
  thumb: 4
};

// Colors for each finger
const COLORS: { [key: string]: string } = {
  index: "#FF0000",
  im: "#FF0000",
  middle: "#0000FF",
  mm: "#0000FF",
  ring: "#FFA500",
  rm: "#FFA500",
  pinky: "#FF00FF",
  pm: "#FF00FF",
  success: "#00FF00"
};

const FINGER_GROUPS = ["index", "middle", "ring", "pinky"];
const BACKEND_URL = "http://localhost:5000";

interface FingerTarget {
  x: number;
  y: number;
  group: string;
}

interface FretPoint {
  x: number;
  y: number;
}

export default function CombinedPage() {
  // Vision refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Vision state
  const [isTracking, setIsTracking] = useState(false);
  const [fretsLocked, setFretsLocked] = useState(false);
  const [readyToLock, setReadyToLock] = useState(false);
  const [status, setStatus] = useState("Loading hand detection model...");
  const [showContent, setShowContent] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [fingerScores, setFingerScores] = useState<{ [key: string]: number }>({});
  const [activeFingerGroups, setActiveFingerGroups] = useState<string[]>([]);
  const [demoScore, setDemoScore] = useState(0);

  // Audio state
  const [rms, setRms] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStatus, setAudioStatus] = useState<"idle" | "calibrating" | "listening" | "recording" | "processing">("idle");
  const [audioPrediction, setAudioPrediction] = useState<any>(null);
  const [threshold, setThreshold] = useState(0.02);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Vision refs for data
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const animationIdRef = useRef<number>(0);
  const fretBoxesRef = useRef<{ [key: string]: FretPoint[] }>({});
  const targetsRef = useRef<{ [key: string]: FingerTarget }>({});
  const visualRadiusRef = useRef(0.05);
  const hitMultiplierRef = useRef(1.6);
  const handLandmarksRef = useRef<any>(null);
  const lastDetectTimeRef = useRef(0);
  const mediaPipeReadyRef = useRef(false);

  // Audio refs for data
  const CALIBRATION_DURATION = 4000;
  const CALIBRATION_SAMPLES = 80;
  const calibrationSamplesRef = useRef<number[]>([]);
  const baselineRmsRef = useRef<number>(0.02);
  const SPIKE_MULTIPLIER = 2.5;
  const COOLDOWN_MS = 1200;
  const cooldownRef = useRef(false);
  const isCalibrating = useRef(false);

  // Refs for keyboard handler
  const isTrackingRef = useRef(false);
  const fretsLockedRef = useRef(false);
  const readyToLockRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    loadMediaPipe();
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => {
      clearTimeout(timer);
      stopEverything();
    };
  }, []);

  // Demo score animation
  useEffect(() => {
    const scores = [0, 45, 72, 88, 95, 60, 33, 78, 92, 55];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % scores.length;
      setDemoScore(scores[index]);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Keep refs in sync
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { fretsLockedRef.current = fretsLocked; }, [fretsLocked]);
  useEffect(() => { readyToLockRef.current = readyToLock; }, [readyToLock]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'y' || e.key === 'Y') && isTrackingRef.current && !fretsLockedRef.current && readyToLockRef.current) {
        lockFretboard();
      }
      if ((e.key === 'r' || e.key === 'R') && fretsLockedRef.current) {
        resetLock();
      }
      if (e.key === 'Escape') {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const loadMediaPipe = async () => {
    try {
      setStatus("Loading MediaPipe...");
      
      const cameraScript = document.createElement("script");
      cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
      cameraScript.crossOrigin = "anonymous";
      document.body.appendChild(cameraScript);
      
      const handsScript = document.createElement("script");
      handsScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
      handsScript.crossOrigin = "anonymous";
      document.body.appendChild(handsScript);

      await Promise.all([
        new Promise((resolve, reject) => { 
          cameraScript.onload = resolve; 
          cameraScript.onerror = reject;
        }),
        new Promise((resolve, reject) => { 
          handsScript.onload = resolve; 
          handsScript.onerror = reject;
        })
      ]);
      
      setStatus("Initializing hand detection model...");

      // @ts-ignore
      const { Hands } = window;
      if (!Hands) {
        throw new Error("Hands class not found");
      }
      
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          handLandmarksRef.current = results.multiHandLandmarks[0];
        } else {
          handLandmarksRef.current = null;
        }
      });

      handsRef.current = hands;
      mediaPipeReadyRef.current = true;
      setStatus("Ready! Click Start Combined Mode");
    } catch (err) {
      console.error("MediaPipe load error:", err);
      setStatus("Failed to load MediaPipe: " + err);
    }
  };

  const startTracking = async () => {
    try {
      setStatus("Starting camera & microphone...");

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      streamRef.current = stream;

      // Setup audio
      await setupAudio();

      setIsTracking(true);
      isTrackingRef.current = true;

      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }

      setStatus("Calibrating audio... Stay quiet");
      setAudioStatus("calibrating");
      isCalibrating.current = true;
      calibrationSamplesRef.current = [];

      setTimeout(() => {
        finishCalibration();
      }, CALIBRATION_DURATION);

    } catch (err) {
      console.error("Camera/Audio error:", err);
      setStatus("Camera or microphone access denied");
    }
  };

  const setupAudio = async () => {
    const audioContext = new AudioContext({ sampleRate: 48000 });
    audioContextRef.current = audioContext;

    const ok = await loadStrumWorklet(audioContext);
    if (!ok) {
      throw new Error("Failed to load audio worklet");
    }

    const node = createStrumNode(audioContext);
    audioNodeRef.current = node;

    node.port.onmessage = (event) => {
      const { type, rms, buffer } = event.data;

      if (type === "RMS") {
        setRms(rms);
        
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

    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStreamRef.current = audioStream;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(node);
  };

  const finishCalibration = () => {
    isCalibrating.current = false;
    
    if (calibrationSamplesRef.current.length > 0) {
      const avgRms = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
      baselineRmsRef.current = Math.max(avgRms * SPIKE_MULTIPLIER, 0.02);
      setThreshold(baselineRmsRef.current);
    }
    
    setAudioStatus("listening");
    setStatus("Align Fret 2 & 3, press Y to lock. Audio ready!");
    setCalibrationProgress(100);
  };

  const detectStrum = (currentRms: number) => {
    if (cooldownRef.current || isCalibrating.current || !fretsLockedRef.current) return;

    if (currentRms > baselineRmsRef.current) {
      setIsRecording(true);
      setAudioStatus("recording");
      cooldownRef.current = true;

      audioNodeRef.current?.port.postMessage({ type: "CAPTURE" });

      setTimeout(() => {
        cooldownRef.current = false;
        setIsRecording(false);
        if (audioStatus !== "processing") {
          setAudioStatus("listening");
        }
      }, COOLDOWN_MS);
    }
  };

  const handleAudioBuffer = async (buffer: Float32Array) => {
    setAudioStatus("processing");

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
      setAudioPrediction(json);
      setAudioStatus("listening");
    } catch (err) {
      console.error("Audio prediction error:", err);
      setAudioStatus("listening");
    }
  };

  // Setup video when tracking starts
  useEffect(() => {
    if (!isTracking || !streamRef.current) return;

    const setupVideo = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      video.srcObject = streamRef.current;
      
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          resolve();
        };
      });

      await video.play();

      if (handsRef.current && mediaPipeReadyRef.current) {
        let isProcessing = false;
        
        const handDetectionLoop = () => {
          if (!isProcessing && video.readyState >= 2) {
            isProcessing = true;
            handsRef.current.send({ image: video }).then(() => {
              isProcessing = false;
              setTimeout(() => {
                if (isTrackingRef.current) {
                  handDetectionLoop();
                }
              }, 33);
            }).catch((err: any) => {
              isProcessing = false;
              if (isTrackingRef.current) {
                setTimeout(handDetectionLoop, 33);
              }
            });
          } else if (isTrackingRef.current) {
            setTimeout(handDetectionLoop, 33);
          }
        };
        
        handDetectionLoop();
      }

      renderLoop();
    };

    setupVideo();
  }, [isTracking]);

  const renderLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();

    if (!fretsLockedRef.current) {
      const now = Date.now();
      if (now - lastDetectTimeRef.current > 150) {
        lastDetectTimeRef.current = now;
        detectFretsFromBackend(video, w, h);
      }
      drawFretBoxes(ctx, w, h);
      
      const landmarks = handLandmarksRef.current;
      if (landmarks) {
        drawHand(ctx, landmarks, w, h);
      }
      
      drawPreLockUI(ctx, w, h);
    } else if (fretsLockedRef.current) {
      const landmarks = handLandmarksRef.current;
      drawLockedMode(ctx, w, h);
    }

    animationIdRef.current = requestAnimationFrame(renderLoop);
  };

  const detectFretsFromBackend = async (video: HTMLVideoElement, w: number, h: number) => {
    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(video, 0, 0, w, h);
      const base64 = tempCanvas.toDataURL("image/jpeg", 0.7);

      const res = await fetch(`${BACKEND_URL}/detect_frets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (data.fret_boxes) {
        fretBoxesRef.current = data.fret_boxes;
        const hasFret2 = data.fret_boxes["1"] && data.fret_boxes["1"].length === 4;
        const hasFret3 = data.fret_boxes["2"] && data.fret_boxes["2"].length === 4;
        
        if (hasFret2 && hasFret3 && !readyToLockRef.current) {
          setReadyToLock(true);
          readyToLockRef.current = true;
        } else if ((!hasFret2 || !hasFret3) && readyToLockRef.current) {
          setReadyToLock(false);
          readyToLockRef.current = false;
        }
      }
    } catch (err) {
      // Ignore
    }
  };

  const drawFretBoxes = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const fretBoxes = fretBoxesRef.current;
    if (!fretBoxes) return;

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#00FF00";

    for (const [fretId, points] of Object.entries(fretBoxes)) {
      if (!points || points.length < 4) continue;

      ctx.beginPath();
      ctx.moveTo(points[0].x * w, points[0].y * h);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * w, points[i].y * h);
      }
      ctx.closePath();
      ctx.stroke();

      const labelX = points[0].x * w;
      const labelY = points[0].y * h - 10;
      ctx.fillText(`Fret ${fretId}`, labelX, labelY);
    }
  };

  const drawPreLockUI = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const msg = readyToLock
      ? "✓ Frets detected! Press 'Y' to LOCK"
      : "Align Fret 2 & 3 in frame...";

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(w / 2 - 200, 20, 400, 50);

    ctx.fillStyle = readyToLock ? "#00FF00" : "#FFFFFF";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText(msg, w / 2, 52);
    ctx.textAlign = "left";
  };

  const drawLockedMode = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const targets = targetsRef.current;
    const fretBoxes = fretBoxesRef.current;
    const landmarks = handLandmarksRef.current;
    const visualRadius = visualRadiusRef.current * w;
    const hitRadius = visualRadius * hitMultiplierRef.current;

    if (fretBoxes) {
      ctx.fillStyle = "rgba(50, 100, 50, 0.3)";
      ctx.strokeStyle = "rgba(50, 150, 50, 1)";
      ctx.lineWidth = 2;

      for (const [, points] of Object.entries(fretBoxes)) {
        if (!points || points.length < 4) continue;
        ctx.beginPath();
        ctx.moveTo(points[0].x * w, points[0].y * h);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * w, points[i].y * h);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    if (landmarks) {
      drawHand(ctx, landmarks, w, h);
    }

    const fingerScoresCalc: { [key: string]: number[] } = {};
    const activeFingers = new Set<string>();

    for (const [fingerName, target] of Object.entries(targets)) {
      const tx = target.x * w;
      const ty = target.y * h;
      const group = target.group;
      activeFingers.add(group);

      let isHit = false;
      let score = 0;

      if (landmarks) {
        const mpId = FINGER_MAP[fingerName];
        if (mpId !== undefined) {
          const lm = landmarks[mpId];
          const fx = (1 - lm.x) * w;
          const fy = lm.y * h;
          const dist = Math.hypot(fx - tx, fy - ty);

          if (dist < hitRadius) {
            isHit = true;
            score = 50;
          } else if (dist < hitRadius * 2.2) {
            const ratio = 1 - (dist - hitRadius) / (hitRadius * 1.2);
            score = Math.max(0, ratio * 50);
          }
        }
      }

      if (!fingerScoresCalc[group]) fingerScoresCalc[group] = [];
      fingerScoresCalc[group].push(score);

      const color = isHit ? COLORS.success : COLORS[group] || "#888888";
      ctx.beginPath();
      ctx.arc(tx, ty, visualRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawLockedUI(ctx, w, h, fingerScoresCalc, activeFingers);
  };

  const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any, w: number, h: number) => {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 2;

    for (const [s, e] of connections) {
      ctx.beginPath();
      ctx.moveTo((1 - landmarks[s].x) * w, landmarks[s].y * h);
      ctx.lineTo((1 - landmarks[e].x) * w, landmarks[e].y * h);
      ctx.stroke();
    }

    ctx.fillStyle = "#00FF00";
    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawLockedUI = (
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    scores: { [key: string]: number[] },
    activeFingers: Set<string>
  ) => {
    let total = 0, max = 0;
    const fingerPercentages: { [key: string]: number } = {};
    
    for (const group of FINGER_GROUPS) {
      if (scores[group]) {
        const s = scores[group].reduce((a, b) => a + b, 0);
        const m = scores[group].length * 50;
        total += s;
        max += m;
        fingerPercentages[group] = m > 0 ? (s / m) * 100 : 0;
      }
    }
    const percent = max > 0 ? (total / max) * 100 : 0;

    let borderColor = "#990000";
    if (percent >= 99) borderColor = "#00FF00";
    else if (percent >= 50) borderColor = "#CCCC00";

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = percent >= 99 ? 20 : 10;
    ctx.strokeRect(0, 0, w, h);

    setCurrentScore(Math.round(percent));
    setFingerScores(fingerPercentages);
    setActiveFingerGroups(Array.from(activeFingers));
  };

  const lockFretboard = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setStatus("Locking fretboard...");

    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(video, 0, 0);
      const base64 = tempCanvas.toDataURL("image/jpeg", 0.8);

      const res = await fetch(`${BACKEND_URL}/lock_fretboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();

      if (data.success) {
        targetsRef.current = data.targets;
        fretBoxesRef.current = data.fret_boxes;
        visualRadiusRef.current = data.visual_radius_norm || 0.05;
        hitMultiplierRef.current = data.hit_radius_multiplier || 1.6;

        fretsLockedRef.current = true;
        setFretsLocked(true);
        setStatus("LOCKED! Place fingers on targets. Strum to analyze!");
      } else {
        setStatus("Lock failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Lock error:", err);
      setStatus("Backend error - is vision.py running?");
    }
  };

  const resetLock = () => {
    fretsLockedRef.current = false;
    setFretsLocked(false);
    targetsRef.current = {};
    handLandmarksRef.current = null;
    readyToLockRef.current = false;
    setReadyToLock(false);
    setCurrentScore(0);
    setFingerScores({});
    setActiveFingerGroups([]);
    setAudioPrediction(null);
    setStatus("Reset. Align frets and press Y to lock.");
  };

  const stopEverything = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    // Stop audio
    audioNodeRef.current?.disconnect();
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    
    setIsTracking(false);
    setFretsLocked(false);
    setReadyToLock(false);
    setFingerScores({});
    setActiveFingerGroups([]);
    setAudioStatus("idle");
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    stopEverything();
    setStatus("Exited. Click Start Combined Mode to begin again.");
  };

  // Interactive card hover
  const [cardHovered, setCardHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 20 });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  };

  const handleCardMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setCardHovered(false);
  };

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

      {/* Navbar - hidden during tracking */}
      {!isTracking && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-50"
        >
          <Navbar />
        </motion.div>
      )}

      {!isTracking ? (
        <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-12">
          
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-sm bg-black/20 mb-6">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium">Vision + Audio</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-4">
              Combined Mode
            </h1>
            <p className="text-lg text-white/60 max-w-lg mx-auto">
              Hand tracking with sound-triggered chord analysis for complete feedback
            </p>
          </motion.div>

          {/* Interactive 3D Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 40 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-lg mb-12"
            style={{ perspective: "1200px" }}
          >
            <motion.div
              className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 cursor-pointer"
              style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
              onMouseMove={handleCardMouseMove}
              onMouseEnter={() => setCardHovered(true)}
              onMouseLeave={handleCardMouseLeave}
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              {/* Spotlight effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: `radial-gradient(600px circle at 50% 50%, rgba(168, 85, 247, 0.15), transparent 40%)`,
                }}
                animate={{ opacity: cardHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />

              {/* Status indicator */}
              <div className="flex items-center gap-2 mb-6">
                {status.includes("Ready") ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                )}
                <span className="text-sm text-white/70">{status}</span>
              </div>

              {/* Preview Animation */}
              <div 
                className="relative h-40 rounded-xl bg-black/40 border border-purple-400/30 flex items-center justify-center overflow-hidden mb-6"
                style={{ transform: "translateZ(30px)" }}
              >
                {/* Scanning rings */}
                <motion.div
                  animate={{ scale: cardHovered ? [1, 1.3, 1] : 1, opacity: cardHovered ? [0.6, 0.2, 0.6] : 0.3 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute w-24 h-24 rounded-full border-2 border-purple-400/50"
                />
                <motion.div
                  animate={{ scale: cardHovered ? [1, 1.5, 1] : 1, opacity: cardHovered ? [0.4, 0.1, 0.4] : 0.2 }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="absolute w-36 h-36 rounded-full border border-purple-400/30"
                />
                
                {/* Center icons */}
                <div className="flex items-center gap-4">
                  <Eye className="w-8 h-8 text-purple-400" />
                  <span className="text-2xl text-purple-400/50">+</span>
                  <Mic className="w-8 h-8 text-purple-400" />
                </div>
                
                {/* Corner markers */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-purple-400/60" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-purple-400/60" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-purple-400/60" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-purple-400/60" />
              </div>

              {/* CTA Button */}
              <button
                onClick={startTracking}
                disabled={!status.includes("Ready")}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{ transform: "translateZ(20px)" }}
              >
                <Eye className="w-5 h-5" />
                Start Combined Mode
              </button>

              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ boxShadow: `0 0 60px rgba(168, 85, 247, 0.3)` }}
                animate={{ opacity: cardHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            </motion.div>
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 30 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full mb-12"
          >
            <div className="border border-white/10 rounded-xl p-5 hover:border-purple-400/40 hover:bg-white/5 transition-all group">
              <Hand className="w-6 h-6 mb-3 text-purple-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Hand Tracking</h3>
              <p className="text-sm text-white/50">MediaPipe 21-point detection</p>
            </div>
            <div className="border border-white/10 rounded-xl p-5 hover:border-purple-400/40 hover:bg-white/5 transition-all group">
              <Mic className="w-6 h-6 mb-3 text-purple-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Audio Analysis</h3>
              <p className="text-sm text-white/50">Sound-triggered chord detection</p>
            </div>
            <div className="border border-white/10 rounded-xl p-5 hover:border-purple-400/40 hover:bg-white/5 transition-all group">
              <CheckCircle2 className="w-6 h-6 mb-3 text-purple-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Combined Feedback</h3>
              <p className="text-sm text-white/50">Visual + Audio scoring</p>
            </div>
          </motion.div>

          {/* Info Text */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: showContent ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="text-center"
          >
            <p className="text-sm text-white/30">
              Click "Start Combined Mode" to begin • Audio calibrates automatically
            </p>
          </motion.div>
        </main>
      ) : (
        <div className="min-h-screen flex flex-col bg-black overflow-hidden">
          {/* Main Tracking Layout */}
          <div className="flex-1 flex min-h-0 items-stretch">
            {/* Left Side Panel */}
            <div className="w-56 shrink-0 bg-gradient-to-r from-neutral-950 to-black flex flex-col justify-center px-5 py-6 border-r border-white/5 z-10">
              <div className="space-y-8">
                {/* Finger Color Legend */}
                <div>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    Finger Colors
                  </h3>
                  <div className="space-y-3">
                    {FINGER_GROUPS.map((group) => {
                      const isActive = activeFingerGroups.includes(group);
                      const score = fingerScores[group] || 0;
                      return (
                        <div 
                          key={group} 
                          className={`flex items-center gap-3 p-2 rounded-lg transition-all duration-300 ${
                            isActive ? 'bg-white/5' : ''
                          }`}
                        >
                          <div 
                            className={`w-5 h-5 rounded-md border-2 transition-all duration-300 ${
                              isActive ? 'border-white/50 shadow-lg' : 'border-white/20'
                            }`}
                            style={{ 
                              backgroundColor: COLORS[group],
                              boxShadow: isActive ? `0 0 12px ${COLORS[group]}50` : 'none'
                            }}
                          />
                          <span className={`text-sm font-medium capitalize transition-colors ${
                            isActive ? 'text-white' : 'text-white/40'
                          }`}>
                            {group}
                          </span>
                          {isActive && fretsLocked && (
                            <span className={`ml-auto text-xs font-bold ${
                              score >= 99 ? 'text-green-400' : 
                              score >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {Math.round(score)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status */}
                <div className="pt-5 border-t border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Status</p>
                  <p className="text-sm text-white/70 leading-relaxed">{status}</p>
                </div>
              </div>
            </div>

            {/* Center - Camera View */}
            <div
              ref={containerRef}
              className="flex-1 flex items-center justify-center bg-black relative z-0"
            >
              <video
                ref={videoRef}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ background: "#000" }}
              />

              {/* Audio Recording Indicator - Mic crossed when idle, open when spike */}
              {fretsLocked && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md transition-all duration-300 ${
                    isRecording 
                      ? 'bg-green-500/20 border border-green-500/50' 
                      : audioStatus === "processing"
                        ? 'bg-yellow-500/20 border border-yellow-500/50'
                        : 'bg-black/40 border border-white/10'
                  }`}>
                    <div className={`relative ${isRecording ? 'animate-pulse' : ''}`}>
                      {isRecording ? (
                        /* Mic OPEN when recording (spike detected) */
                        <Mic className="w-6 h-6 text-green-400" />
                      ) : audioStatus === "processing" ? (
                        <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
                      ) : (
                        /* Mic CROSSED when idle/listening */
                        <MicOff className="w-6 h-6 text-white/40" />
                      )}
                      {isRecording && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      isRecording ? 'text-green-400' : 
                      audioStatus === "processing" ? 'text-yellow-400' : 'text-white/40'
                    }`}>
                      {isRecording ? 'Capturing Audio...' : 
                       audioStatus === "processing" ? 'Analyzing Chord...' : 
                       'Mic Muted'}
                    </span>
                    {/* Audio level bar - shows spike level */}
                    <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-75 ${
                          isRecording ? 'bg-green-400' : 
                          rms > threshold * 0.6 ? 'bg-yellow-400' : 'bg-white/20'
                        }`}
                        style={{ width: `${Math.min(rms * 500, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Calibration Overlay */}
              {audioStatus === "calibrating" && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Calibrating Audio...</h3>
                    <p className="text-white/60 mb-4">Please stay quiet</p>
                    <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mx-auto">
                      <div 
                        className="h-full bg-purple-400 rounded-full transition-all duration-200"
                        style={{ width: `${calibrationProgress}%` }}
                      />
                    </div>
                    <p className="text-white/40 text-sm mt-2">{Math.round(calibrationProgress)}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Panel */}
            <div className="w-56 shrink-0 bg-gradient-to-l from-neutral-950 to-black flex flex-col justify-center px-5 py-6 border-l border-white/5 z-10">
              <div className="space-y-6">
                {/* Vision Score */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Vision Score
                  </p>
                  <div className={`text-4xl font-bold ${
                    !fretsLocked ? 'text-white/20' :
                    currentScore >= 99 ? 'text-green-400' : 
                    currentScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {fretsLocked ? `${currentScore}%` : '--'}
                  </div>
                </div>

                {/* Audio Prediction */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                    <Music className="w-3 h-3 inline mr-1" />
                    Audio Result
                  </p>
                  {audioPrediction ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-white truncate">
                        {audioPrediction.label || audioPrediction.prediction}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${(audioPrediction.confidence || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-purple-400 font-mono">
                          {((audioPrediction.confidence || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed">
                        {audioPrediction.feedback || audioPrediction.advice}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-white/30">
                      {fretsLocked ? "Strum to analyze..." : "Lock frets first"}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Controls</p>
                  <div className="space-y-2 text-xs">
                    {!fretsLocked && (
                      <div className="flex items-center gap-2 text-white/50">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">Y</kbd>
                        <span>Lock</span>
                      </div>
                    )}
                    {fretsLocked && (
                      <div className="flex items-center gap-2 text-white/50">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">R</kbd>
                        <span>Reset</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-white/50">
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px]">ESC</kbd>
                      <span>Exit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div className="bg-black border-t border-white/10 px-6 py-3">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3">
              {fretsLocked && (
                <button
                  onClick={resetLock}
                  className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium text-white/70 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 group-hover:rotate-[-45deg] transition-transform duration-300" />
                  <span>Reset</span>
                  <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">R</kbd>
                </button>
              )}
              <button
                onClick={exitFullscreen}
                className="group flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/40 transition-all text-sm font-medium text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                <span>Exit</span>
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-mono">ESC</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

