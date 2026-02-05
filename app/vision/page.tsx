"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { 
  Eye,
  ChevronLeft,
  Loader2,
  Hand,
  Target,
  CheckCircle2,
  Crosshair,
  RotateCcw,
  X
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
  index: "#FF0000",    // Red
  im: "#FF0000",
  middle: "#0000FF",   // Blue
  mm: "#0000FF",
  ring: "#FFA500",     // Orange
  rm: "#FFA500",
  pinky: "#FF00FF",    // Magenta
  pm: "#FF00FF",
  success: "#00FF00"   // Green
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

export default function VisionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [fretsLocked, setFretsLocked] = useState(false);
  const [readyToLock, setReadyToLock] = useState(false);
  const [status, setStatus] = useState("Loading hand detection model...");
  const [showContent, setShowContent] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);
  const [fingerScores, setFingerScores] = useState<{ [key: string]: number }>({});
  const [activeFingerGroups, setActiveFingerGroups] = useState<string[]>([]);
  const [demoScore, setDemoScore] = useState(0);

  // Use refs for data that changes frequently (avoids re-renders)
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

  // Refs for keyboard handler (to avoid stale closures)
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

  // Demo score animation for the getting started card
  useEffect(() => {
    const scores = [0, 45, 72, 88, 95, 60, 33, 78, 92, 55];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % scores.length;
      setDemoScore(scores[index]);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Keep refs in sync with state
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { fretsLockedRef.current = fretsLocked; }, [fretsLocked]);
  useEffect(() => { readyToLockRef.current = readyToLock; }, [readyToLock]);

  // Keyboard controls (use refs to avoid stale closures)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.key === 'y' || e.key === 'Y') && isTrackingRef.current && !fretsLockedRef.current && readyToLockRef.current) {
        console.log('Locking fretboard...');
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
  }, []); // Empty deps - handler uses refs

  const loadMediaPipe = async () => {
    try {
      setStatus("Loading MediaPipe...");
      
      // Load MediaPipe Camera Utils (recommended way to use MediaPipe)
      const cameraScript = document.createElement("script");
      cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
      cameraScript.crossOrigin = "anonymous";
      document.body.appendChild(cameraScript);
      
      // Load MediaPipe Hands - using correct CDN URL
      const handsScript = document.createElement("script");
      handsScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
      handsScript.crossOrigin = "anonymous";
      document.body.appendChild(handsScript);

      // Wait for scripts to load
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
      
      console.log("MediaPipe scripts loaded successfully");
      setStatus("Initializing hand detection model...");

      // @ts-ignore
      const { Hands } = window;
      if (!Hands) {
        throw new Error("Hands class not found on window");
      }
      
      const hands = new Hands({
        locateFile: (file: string) => {
          const url = `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          console.log("MediaPipe loading file:", file);
          return url;
        },
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      let resultCount = 0;
      hands.onResults((results: any) => {
        resultCount++;
        if (resultCount % 30 === 0) {
          console.log("MediaPipe results:", {
            hasLandmarks: !!results.multiHandLandmarks,
            count: results.multiHandLandmarks?.length || 0
          });
        }
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          handLandmarksRef.current = results.multiHandLandmarks[0];
        } else {
          handLandmarksRef.current = null;
        }
      });

      handsRef.current = hands;
      mediaPipeReadyRef.current = true;
      console.log('MediaPipe Hands ready');
      setStatus("Ready! Click Start Tracking");
    } catch (err) {
      console.error("MediaPipe load error:", err);
      setStatus("Failed to load MediaPipe: " + err);
    }
  };

  // Ref to store MediaPipe Camera instance
  const mpCameraRef = useRef<any>(null);

  const startTracking = async () => {
    try {
      setStatus("Starting camera...");

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      streamRef.current = stream;

      setIsTracking(true);
      isTrackingRef.current = true;

      // Enter fullscreen
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }

      setStatus("Align Fret 2 & 3 in frame, then press Y to lock");

    } catch (err) {
      console.error("Camera error:", err);
      setStatus("Camera access denied");
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
      
      // Wait for video metadata
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          resolve();
        };
      });

      await video.play();

      // Start MediaPipe hand detection via direct polling (simpler and more reliable)
      if (handsRef.current && mediaPipeReadyRef.current) {
        let isProcessing = false;
        
        const handDetectionLoop = () => {
          if (!isProcessing && video.readyState >= 2) {
            isProcessing = true;
            // Send video frame to MediaPipe
            handsRef.current.send({ image: video }).then(() => {
              isProcessing = false;
              // Schedule next detection
              setTimeout(() => {
                if (isTrackingRef.current) {
                  handDetectionLoop();
                }
              }, 33); // ~30fps
            }).catch((err: any) => {
              console.error("MediaPipe send error:", err);
              isProcessing = false;
              if (isTrackingRef.current) {
                setTimeout(handDetectionLoop, 33);
              }
            });
          } else if (isTrackingRef.current) {
            setTimeout(handDetectionLoop, 33);
          }
        };
        
        console.log("Starting hand detection loop");
        handDetectionLoop();
      }

      // Start render loop for drawing
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

    // 1. Draw video frame (mirrored)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -w, 0, w, h);
    ctx.restore();

    // 2. MediaPipe hand detection is handled by Camera utility (no manual send needed)

    // 3. Detect frets via backend (before lock, every 150ms for faster response)
    if (!fretsLockedRef.current) {
      const now = Date.now();
      if (now - lastDetectTimeRef.current > 150) {
        lastDetectTimeRef.current = now;
        detectFretsFromBackend(video, w, h);
      }
      // Draw detected fret boxes
      drawFretBoxes(ctx, w, h);
      
      // Draw hand skeleton even before lock (for debugging/visual feedback)
      const landmarks = handLandmarksRef.current;
      if (landmarks) {
        drawHand(ctx, landmarks, w, h);
      }
      
      // Draw pre-lock UI
      drawPreLockUI(ctx, w, h);
    } else if (fretsLockedRef.current) {
      // 4. After lock: Draw targets and hand
      const landmarks = handLandmarksRef.current;
      
      // DEBUG: Log if landmarks exist
      if (landmarks === null) {
        console.log("DEBUG: No hand landmarks detected after lock");
      }
      
      drawLockedMode(ctx, w, h);
    }

    // Continue loop
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
        // Check if both frets detected
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
      // Ignore fetch errors
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

      // Label
      const labelX = points[0].x * w;
      const labelY = points[0].y * h - 10;
      ctx.fillText(`Fret ${fretId}`, labelX, labelY);
    }
  };

  const drawPreLockUI = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const msg = readyToLock
      ? "✓ Frets detected! Press 'Y' to LOCK"
      : "Align Fret 2 & 3 in frame...";

    // Background box
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(w / 2 - 200, 20, 400, 50);

    // Text
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

    // Draw fret overlay (semi-transparent green)
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

    // Draw hand skeleton
    if (landmarks) {
      drawHand(ctx, landmarks, w, h);
    }

    // Calculate scores and draw targets
    const fingerScores: { [key: string]: number[] } = {};
    const activeFingers = new Set<string>();

    for (const [fingerName, target] of Object.entries(targets)) {
      const tx = target.x * w;
      const ty = target.y * h;
      const group = target.group;
      activeFingers.add(group);

      let isHit = false;
      let score = 0;

      // Check distance to finger
      if (landmarks) {
        const mpId = FINGER_MAP[fingerName];
        if (mpId !== undefined) {
          const lm = landmarks[mpId];
          const fx = (1 - lm.x) * w; // Mirror X
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

      if (!fingerScores[group]) fingerScores[group] = [];
      fingerScores[group].push(score);

      // Draw target circle
      const color = isHit ? COLORS.success : COLORS[group] || "#888888";
      ctx.beginPath();
      ctx.arc(tx, ty, visualRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw UI overlay
    drawLockedUI(ctx, w, h, fingerScores, activeFingers);
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
    // Calculate overall score
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

    // Border color based on score
    let borderColor = "#990000";
    if (percent >= 99) borderColor = "#00FF00";
    else if (percent >= 50) borderColor = "#CCCC00";

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = percent >= 99 ? 20 : 10;
    ctx.strokeRect(0, 0, w, h);

    // Update React state for HUD panels (throttled)
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
        setStatus("LOCKED! Place fingers on targets. Press R to reset.");
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
    setStatus("Reset. Align frets and press Y to lock.");
  };

  const stopEverything = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setIsTracking(false);
    setFretsLocked(false);
    setReadyToLock(false);
    setFingerScores({});
    setActiveFingerGroups([]);
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    stopEverything();
    setStatus("Exited. Click Start Tracking to begin again.");
  };

  // Interactive card hover state
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
              <Eye className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">Computer Vision</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-4">
              Vision Mode
            </h1>
            <p className="text-lg text-white/60 max-w-lg mx-auto">
              Real-time hand tracking with finger position guidance using MediaPipe
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
                  background: `radial-gradient(600px circle at 50% 50%, rgba(147, 197, 253, 0.15), transparent 40%)`,
                }}
                animate={{ opacity: cardHovered ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />

              {/* Status indicator */}
              <div className="flex items-center gap-2 mb-6">
                {status.includes("Ready") ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                )}
                <span className="text-sm text-white/70">{status}</span>
              </div>

              {/* Vision Preview Animation */}
              <div 
                className="relative h-40 rounded-xl bg-black/40 border border-blue-400/30 flex items-center justify-center overflow-hidden mb-6"
                style={{ transform: "translateZ(30px)" }}
              >
                {/* Scanning rings */}
                <motion.div
                  animate={{ scale: cardHovered ? [1, 1.3, 1] : 1, opacity: cardHovered ? [0.6, 0.2, 0.6] : 0.3 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute w-24 h-24 rounded-full border-2 border-blue-400/50"
                />
                <motion.div
                  animate={{ scale: cardHovered ? [1, 1.5, 1] : 1, opacity: cardHovered ? [0.4, 0.1, 0.4] : 0.2 }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  className="absolute w-36 h-36 rounded-full border border-blue-400/30"
                />
                <motion.div
                  animate={{ scale: cardHovered ? [1, 1.7, 1] : 1, opacity: cardHovered ? [0.3, 0.05, 0.3] : 0.1 }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                  className="absolute w-48 h-48 rounded-full border border-blue-400/20"
                />
                
                {/* Center crosshair */}
                <Crosshair className="w-10 h-10 text-blue-400" />
                
                {/* Corner markers */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-blue-400/60" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-blue-400/60" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-blue-400/60" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-blue-400/60" />
              </div>

              {/* CTA Button */}
              <button
                onClick={startTracking}
                disabled={!status.includes("Ready")}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:hover:scale-100 flex items-center justify-center gap-2"
                style={{ transform: "translateZ(20px)" }}
              >
                <Eye className="w-5 h-5" />
                Start Tracking
              </button>

              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{ boxShadow: `0 0 60px rgba(147, 197, 253, 0.3)` }}
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
            <div className="border border-white/10 rounded-xl p-5 hover:border-blue-400/40 hover:bg-white/5 transition-all group">
              <Hand className="w-6 h-6 mb-3 text-blue-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Hand Tracking</h3>
              <p className="text-sm text-white/50">MediaPipe 21-point landmark detection</p>
            </div>
            <div className="border border-white/10 rounded-xl p-5 hover:border-blue-400/40 hover:bg-white/5 transition-all group">
              <Target className="w-6 h-6 mb-3 text-blue-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Fret Detection</h3>
              <p className="text-sm text-white/50">YOLO OBB model for precise fret location</p>
            </div>
            <div className="border border-white/10 rounded-xl p-5 hover:border-blue-400/40 hover:bg-white/5 transition-all group">
              <CheckCircle2 className="w-6 h-6 mb-3 text-blue-400 group-hover:scale-110 transition-transform" />
              <h3 className="font-medium mb-1">Real-time Feedback</h3>
              <p className="text-sm text-white/50">Instant scoring and visual guidance</p>
            </div>
          </motion.div>

          {/* Instructions & Control Guide */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 20 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="w-full max-w-5xl"
          >
            {/* Guide Title */}
            <div className="text-center mb-10">
              <h2 className="text-2xl font-light text-white mb-2">Getting Started</h2>
              <p className="text-sm text-white/40">Follow these steps to begin chord tracking</p>
            </div>

            {/* Interactive Control Cards Grid - 3 columns like homepage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* 1. Lock Frets Card */}
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={startTracking}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 cursor-pointer transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                
                {/* Title & Description */}
                <h3 className="text-lg font-medium text-white mb-2">Lock Fretboard</h3>
                <p className="text-sm text-white/50 mb-6">Position frets 2 & 3 in frame and press Y to lock the detection area.</p>
                
                {/* Animation Area */}
                <div className="relative h-32 rounded-xl bg-black/40 border border-blue-400/10 overflow-hidden">
                  {/* Lock Animation */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Lock body */}
                    <div className="relative">
                      <motion.div 
                        className="w-14 h-11 bg-blue-400/20 rounded-lg border-2 border-blue-400/40 flex items-center justify-center"
                      >
                        {/* Keyhole */}
                        <div className="w-2.5 h-2.5 bg-blue-400/60 rounded-full" />
                        <div className="absolute bottom-2 w-1 h-3 bg-blue-400/60" />
                      </motion.div>
                      {/* Shackle */}
                      <motion.div 
                        className="absolute -top-5 left-1/2 -translate-x-1/2 w-8 h-7 border-[3px] border-blue-400/40 rounded-t-full border-b-0"
                        initial={{ y: 0, rotate: 0 }}
                        whileHover={{ y: -8, rotate: -20 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      />
                    </div>
                  </div>
                  {/* Kbd hint */}
                  <div className="absolute bottom-3 right-3">
                    <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/40 font-mono">Y</kbd>
                  </div>
                </div>
              </motion.div>

              {/* 2. Position Fingers Card */}
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 cursor-default transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mb-5">
                  <Hand className="w-6 h-6 text-blue-400" />
                </div>
                
                {/* Title & Description */}
                <h3 className="text-lg font-medium text-white mb-2">Position Fingers</h3>
                <p className="text-sm text-white/50 mb-6">Place your fingers on the colored target circles matching your chord shape.</p>
                
                {/* Animation Area */}
                <div className="relative h-32 rounded-xl bg-black/40 border border-blue-400/10 overflow-hidden">
                  {/* Finger dots with subtle animation */}
                  <div className="absolute inset-0 flex items-center justify-center gap-4">
                    {[
                      { color: '#ef4444', delay: 0 },
                      { color: '#3b82f6', delay: 0.1 },
                      { color: '#f97316', delay: 0.2 },
                      { color: '#a855f7', delay: 0.3 }
                    ].map((dot, i) => (
                      <motion.div
                        key={i}
                        className="w-5 h-5 rounded-full border-2"
                        style={{ 
                          backgroundColor: `${dot.color}40`,
                          borderColor: `${dot.color}80`
                        }}
                        initial={{ scale: 1, opacity: 0.6 }}
                        whileHover={{ scale: 1.3, opacity: 1 }}
                        animate={{ 
                          y: [0, -6, 0],
                          opacity: [0.6, 1, 0.6]
                        }}
                        transition={{ 
                          y: { delay: dot.delay, duration: 1.5, repeat: Infinity },
                          opacity: { delay: dot.delay, duration: 1.5, repeat: Infinity }
                        }}
                      />
                    ))}
                  </div>
                  {/* Hand indicator moving across */}
                  <motion.div
                    className="absolute bottom-6 left-0 w-4 h-4"
                    animate={{ x: [20, 140, 20] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="w-3 h-3 bg-blue-400/60 rounded-full" />
                  </motion.div>
                </div>
              </motion.div>

              {/* 3. Track Score Card */}
              <motion.div
                whileHover={{ scale: 1.02, y: -4 }}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 cursor-default transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-blue-400/10 border border-blue-400/20 flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-6 h-6 text-blue-400" />
                </div>
                
                {/* Title & Description */}
                <h3 className="text-lg font-medium text-white mb-2">Track Your Score</h3>
                <p className="text-sm text-white/50 mb-6">Get real-time feedback as your accuracy improves. Press R to reset or ESC to exit.</p>
                
                {/* Animation Area */}
                <div className="relative h-32 rounded-xl bg-black/40 border border-blue-400/10 overflow-hidden">
                  {/* Score display with animated ring */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* Progress ring */}
                      <svg className="w-20 h-20 -rotate-90">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                        <motion.circle
                          cx="40" cy="40" r="34" fill="none" stroke="rgba(96, 165, 250, 0.6)" strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="213.6"
                          animate={{ strokeDashoffset: 213.6 - (demoScore / 100) * 213.6 }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                        />
                      </svg>
                      {/* Score text - synced with ring */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl font-light transition-colors duration-300 ${
                          demoScore >= 80 ? 'text-blue-400' : 
                          demoScore >= 50 ? 'text-yellow-400' : 'text-white/60'
                        }`}>
                          {demoScore}
                          <span className="text-sm text-white/40">%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Kbd hints */}
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/40 font-mono">R</kbd>
                    <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/40 font-mono">ESC</kbd>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Info Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="mt-10 text-center"
            >
              <p className="text-sm text-white/30">
                Click "Lock Fretboard" above to begin • Ensure good lighting for best results
              </p>
            </motion.div>
          </motion.div>
        </main>
      ) : (
        <div className="min-h-screen flex flex-col bg-black overflow-hidden">
          {/* Main Tracking Layout */}
          <div className="flex-1 flex min-h-0 items-stretch">
            {/* Left Side Panel - Guides Legend */}
            <div className="w-56 shrink-0 bg-gradient-to-r from-neutral-950 to-black flex flex-col justify-center px-5 py-6 border-r border-white/5 z-10">
              <div className="space-y-8">
                {/* Finger Color Legend - Always visible */}
                <div>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
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
            </div>

            {/* Right Side Panel - Progress & Score */}
            <div className="w-56 shrink-0 bg-gradient-to-l from-neutral-950 to-black flex flex-col justify-center px-5 py-6 border-l border-white/5 z-10">
              <div className="space-y-6">
                {/* Score Display - shows placeholder before lock */}
                <div className="text-center">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    Chord Score
                  </p>
                  <div className={`text-4xl font-bold ${
                    !fretsLocked ? 'text-white/20' :
                    currentScore >= 99 ? 'text-green-400' : 
                    currentScore >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {fretsLocked ? `${currentScore}%` : '--'}
                  </div>
                  {!fretsLocked && (
                    <p className="text-xs text-white/30 mt-2">Lock frets to start</p>
                  )}
                </div>

                {/* Finger Progress Circles */}
                {fretsLocked && activeFingerGroups.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4 text-center">
                      Progress
                    </p>
                    <div className="space-y-4">
                      {activeFingerGroups.map((group) => {
                        const score = fingerScores[group] || 0;
                        const color = score >= 99 ? '#00FF00' : score >= 50 ? '#FFFF00' : '#FF0000';
                        return (
                          <div key={group} className="flex items-center gap-3">
                            {/* SVG Progress Circle */}
                            <div className="relative w-12 h-12">
                              <svg className="w-12 h-12 transform -rotate-90">
                                {/* Background circle */}
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  fill="none"
                                  stroke="#333"
                                  strokeWidth="4"
                                />
                                {/* Progress arc */}
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="20"
                                  fill="none"
                                  stroke={color}
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  strokeDasharray={`${(score / 100) * 125.6} 125.6`}
                                />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/70 uppercase">
                                {group[0]}
                              </span>
                            </div>
                            <span className="text-sm text-white/50 capitalize flex-1">{group}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Controls Hint */}
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