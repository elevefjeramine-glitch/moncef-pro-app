"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Center,
  ContactShadows,
  Environment,
  Float,
  Lightformer,
  MeshDistortMaterial,
  MeshTransmissionMaterial,
  PerformanceMonitor,
  Sparkles,
  Text3D,
} from "@react-three/drei";
import type { FontData } from "@react-three/drei/core/useFont";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { isCoarsePointer, shouldUseWebGL } from "./gpu";
// Self-hosted typeface (build-time download, zero runtime network).
import typefaceJson from "../../../public/fonts/helvetiker_bold.typeface.json";

const brandFont = typefaceJson as unknown as FontData;

/* ------------------------------------------------------------------ */
/* Subtle mouse parallax rig — lerps the camera ±0.35 on fine pointers. */
/* ------------------------------------------------------------------ */

function CameraRig() {
  const finePointer = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: fine)").matches,
    []
  );

  useFrame((state, delta) => {
    if (!finePointer) return;
    const damp = Math.min(1, delta * 2.2);
    const cam = state.camera;
    cam.position.x += (state.pointer.x * 0.35 - cam.position.x) * damp;
    cam.position.y += (state.pointer.y * 0.35 - cam.position.y) * damp;
    cam.lookAt(0, 0, 0);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* The glass hero jewel: a slowly turning torus knot in transmission   */
/* glass, refracting the brand gradient behind it.                     */
/* ------------------------------------------------------------------ */

function GlassKnot() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.x += delta * 0.12;
    m.rotation.y += delta * 0.18;
  });
  return (
    <Float speed={1.6} rotationIntensity={0.25} floatIntensity={1.1}>
      <mesh ref={ref} position={[1.15, 0.15, 0]}>
        <torusKnotGeometry args={[1.02, 0.3, 200, 32]} />
        <MeshTransmissionMaterial
          color="#dfe9ff"
          transmission={1}
          thickness={1.4}
          roughness={0.08}
          chromaticAberration={0.06}
          anisotropicBlur={0.35}
          distortion={0.3}
          distortionScale={0.35}
          temporalDistortion={0.12}
          ior={1.35}
          resolution={512}
          samples={6}
        />
      </mesh>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/* Depth layer: the breathing distort blob, pushed back-left in deep   */
/* blue so the glass knot stays the focal point.                       */
/* ------------------------------------------------------------------ */

function DepthBlob() {
  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh position={[-2.4, -0.5, -2.8]} scale={1.25}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <MeshDistortMaterial distort={0.42} speed={1.4} color="#2b4bff" roughness={0.3} metalness={0.35} />
      </mesh>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/* Technical jewelry: two thin chrome orbit rings around the knot.     */
/* ------------------------------------------------------------------ */

function OrbitRings() {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (a.current) a.current.rotation.z += delta * 0.22;
    if (b.current) b.current.rotation.z -= delta * 0.16;
  });
  const chrome = useMemo(
    () => ({ color: "#cfe3ff", metalness: 1, roughness: 0.18, envMapIntensity: 1.6 }) as const,
    []
  );
  return (
    <group position={[1.15, 0.15, 0]}>
      <mesh ref={a} rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[1.85, 0.014, 12, 160]} />
        <meshStandardMaterial {...chrome} />
      </mesh>
      <mesh ref={b} rotation={[Math.PI / 1.7, -0.4, 0.5]}>
        <torusGeometry args={[2.25, 0.01, 12, 160]} />
        <meshStandardMaterial {...chrome} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Floating chrome "IA" brand mark — the only 3D type on the page, and */
/* brand-neutral across all five languages. Self-hosted typeface, zero */
/* network.                                                            */
/* ------------------------------------------------------------------ */

function BrandMark() {
  return (
    <Float speed={2.2} rotationIntensity={0.35} floatIntensity={0.9}>
      <group position={[-1.15, 1.35, -0.6]} rotation={[-0.08, 0.25, 0]}>
        <Center>
          <Text3D font={brandFont} size={0.62} height={0.16} bevelEnabled bevelSize={0.02} bevelThickness={0.02}>
            IA
            <meshPhysicalMaterial
              color="#eaf2ff"
              metalness={1}
              roughness={0.16}
              envMapIntensity={1.8}
              clearcoat={0.6}
            />
          </Text3D>
        </Center>
      </group>
    </Float>
  );
}

type Quality = 0 | 1 | 2;

interface SceneContentsProps {
  quality: Quality;
  onDecline: () => void;
}

/* ------------------------------------------------------------------ */
/* Scene contents: glass knot + depth blob + orbit rings + IA mark +    */
/* sparkles + local lighting + tiered post-processing.                 */
/* ------------------------------------------------------------------ */

function SceneContents({ quality, onDecline }: SceneContentsProps) {
  const sparkleCount = useMemo(() => (isCoarsePointer() ? 40 : 130), []);

  return (
    <>
      <PerformanceMonitor onDecline={onDecline}>
        <CameraRig />

        {/* Key / fill lighting */}
        <directionalLight
          castShadow
          position={[4, 6, 4]}
          intensity={1.2}
          shadow-mapSize={[1024, 1024]}
        />
        <ambientLight intensity={0.35} />

        {/* Fully local environment lighting: no files, no preset, zero network. */}
        <Environment resolution={256}>
          <Lightformer form="circle" intensity={4} color="#5982ff" position={[-5, 2, -1]} scale={4} />
          <Lightformer form="rect" intensity={3} color="#00d2b6" position={[5, -1, -1]} scale={[4, 2]} />
          <Lightformer form="circle" intensity={2} color="#a78bfa" position={[0, 5, 0]} scale={3} />
        </Environment>

        <Suspense fallback={null}>
          <GlassKnot />
          <DepthBlob />
          <OrbitRings />
          <BrandMark />
        </Suspense>

        <Sparkles
          count={sparkleCount}
          scale={[11, 7, 5]}
          size={2.5}
          speed={0.35}
          color="#7df9e8"
          opacity={0.6}
        />

        <ContactShadows position={[0, -2.7, 0]} opacity={0.5} blur={2.4} far={4.5} />
      </PerformanceMonitor>

      {quality < 2 && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.32} intensity={0.55} mipmapBlur />
          {quality === 0 && (
            <>
              <Noise premultiply opacity={0.09} />
              <Vignette offset={0.25} darkness={0.35} />
            </>
          )}
        </EffectComposer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* HeroScene: the R3F canvas. Decorative; the parent positions it.      */
/* Renders null on the server and whenever WebGL should not be used    */
/* (the MeshGradient poster covers the background in that case).       */
/* The render loop is fully gated: it runs only while the hero is      */
/* near the viewport AND the tab is visible.                           */
/* ------------------------------------------------------------------ */

export function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>([1, 1.75]);
  const [running, setRunning] = useState(true);
  // 0 = full quality, 1 = bloom only (no grain/vignette), 2 = no composer.
  const [quality, setQuality] = useState<Quality>(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const webglOK = useMemo(() => shouldUseWebGL(), []);

  // Gate the render loop: near-viewport + tab visible.
  useEffect(() => {
    if (!webglOK) return;
    const el = wrapRef.current;
    let inView = true;
    const apply = () => setRunning(inView && !document.hidden);
    const io =
      typeof IntersectionObserver !== "undefined" && el
        ? new IntersectionObserver(
            (entries) => {
              inView = entries[0]?.isIntersecting ?? true;
              apply();
            },
            { rootMargin: "240px" }
          )
        : null;
    if (io && el) io.observe(el);
    document.addEventListener("visibilitychange", apply);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", apply);
    };
  }, [webglOK]);

  const handleDecline = useCallback(() => {
    setDpr(1);
    setQuality((q) => (q === 0 ? 1 : 2));
  }, []);

  if (!mounted || !webglOK) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        opacity: ready ? 1 : 0,
        transition: "opacity 1.2s ease-out",
        pointerEvents: "none",
      }}
    >
      <Canvas
        dpr={dpr}
        frameloop={running ? "always" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 7.4], fov: 42 }}
        onCreated={() => setReady(true)}
      >
        <SceneContents quality={quality} onDecline={handleDecline} />
      </Canvas>
    </div>
  );
}
