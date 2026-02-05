"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, Float } from "@react-three/drei";
import { useScroll, useTransform } from "framer-motion";
import * as THREE from "three";

// --- Configuration ---
// Tweak these values to align the guitar with your text
const GUITAR_POSITION: [number, number, number] = [1.2, -0.5, 0]; // Push to right
const GUITAR_SCALE = 1.4;

function GuitarModel({ scrollProgress }: { scrollProgress: number }) {
  const { scene } = useGLTF("/guitar.glb");
  const meshRef = useRef<THREE.Group>(null);
  
  // Clone scene to avoid reuse issues
  const clonedScene = useRef<THREE.Group>(scene.clone());

  useFrame((state) => {
    if (!meshRef.current) return;

    // 1. Initial Rotation (Starting angle to look cool)
    // We rotate it slightly so the neck points towards the top-left text
    const initialRotation = { x: 0.1, y: -0.5, z: 0.2 };

    // 2. Dynamic Scroll Rotation
    // Instead of spinning 360, let's rotate it to show different angles as user scrolls
    const rotationY = initialRotation.y + (scrollProgress * Math.PI * 0.5); 
    const rotationX = initialRotation.x + (Math.sin(scrollProgress * Math.PI) * 0.2);

    // Apply smooth interpolation (optional, but looks cleaner)
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, rotationX, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, rotationY, 0.1);
    meshRef.current.rotation.z = initialRotation.z;
  });

  return (
    <group position={GUITAR_POSITION}>
        {/* Float adds that subtle "levitating" breathing animation automatically */}
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <primitive 
                ref={meshRef} 
                object={clonedScene.current} 
                scale={[GUITAR_SCALE, GUITAR_SCALE, GUITAR_SCALE]}
            />
        </Float>
    </group>
  );
}

function LoadingFallback() {
  return null; // Better to show nothing than a box while loading in a hero section
}

export function Guitar3DModel() {
  const { scrollYProgress } = useScroll();
  const [scrollValue, setScrollValue] = useState(0);

  // Smooth out the scroll value slightly if needed, or use raw
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", setScrollValue);
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <Canvas
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        camera={{ position: [0, 0, 4.5], fov: 40 }}
        style={{ width: "100%", height: "100%" }}
        dpr={[1, 2]} // Handle high-DPI screens
      >
        {/* --- Lighting Setup --- */}
        {/* Studio lighting environment map - makes chrome/glossy parts look real */}
        <Environment preset="city" />
        
        {/* Fill light for dark spots */}
        <ambientLight intensity={0.3} />
        
        {/* Rim light to separate guitar from black background */}
        <spotLight 
            position={[-5, 5, 5]} 
            angle={0.2} 
            penumbra={0.8} 
            intensity={4} 
            color="#4a9eff" // Subtle blue rim light matches "tech" vibe
        />

        {/* --- Objects --- */}
        <Suspense fallback={<LoadingFallback />}>
          <GuitarModel scrollProgress={scrollValue} />
        </Suspense>
        
        {/* --- Shadows --- */}
        {/* Adds a soft shadow beneath the guitar to give it volume */}
        <ContactShadows 
            position={[1.2, -2, 0]} 
            opacity={0.4} 
            scale={10} 
            blur={2.5} 
            far={4} 
        />
      </Canvas>
    </div>
  );
}

// Preload
if (typeof window !== "undefined") {
  useGLTF.preload("/guitar.glb");
}