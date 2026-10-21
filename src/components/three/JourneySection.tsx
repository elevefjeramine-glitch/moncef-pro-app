"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export type JourneyItem = {
  icon: ReactNode;
  title: string;
  desc: string;
  accent: string;
};

export type JourneySectionProps = {
  kicker: string;
  lede: string;
  items: [JourneyItem, JourneyItem, JourneyItem]; // exactly 3, tuple
};

type ProgressRef = MutableRefObject<{ value: number }>;

const WAYPOINTS: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
  new THREE.Vector3(0, 0.5, 7.6),
  new THREE.Vector3(-3.4, 1.0, 5.0),
  new THREE.Vector3(3.4, -0.8, 5.4),
] as const;

function stationWeight(p: number, k: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(p * 2 - k) * 1.35));
}

function applyStationWeight(g: THREE.Group | null, w: number, delta: number): void {
  if (!g) return;
  g.visible = w > 0.02;
  if (!g.visible) return;
  g.scale.setScalar(0.82 + 0.18 * w);
  g.rotation.y += delta * 0.12;
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(m)) {
      for (const x of m) x.opacity = w;
    } else if (m) {
      m.opacity = w;
    }
  });
}

const BOX_COUNT = 56;

function StationRing(): ReactNode {
  const inst = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = inst.current;
    if (!m) return;
    const dummy = new THREE.Object3D();
    for (let k = 0; k < BOX_COUNT; k++) {
      const ang = (k / BOX_COUNT) * Math.PI * 2;
      const r = 2.5 + Math.sin(ang * 3) * 0.35;
      dummy.position.set(Math.cos(ang) * r, Math.sin(ang * 2) * 0.55, Math.sin(ang) * r);
      dummy.rotation.set(ang, ang * 0.7, 0);
      dummy.scale.setScalar(0.16 + 0.12 * Math.abs(Math.sin(ang * 5)));
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={inst} args={[undefined, undefined, BOX_COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#1b1440"
        emissive="#a78bfa"
        emissiveIntensity={0.7}
        roughness={0.35}
        metalness={0.2}
        transparent
      />
    </instancedMesh>
  );
}

function JourneyScene({ progress }: { progress: ProgressRef }): ReactNode {
  const groups = useRef<Array<THREE.Group | null>>([]);

  useFrame((state, delta) => {
    const p = Math.max(0, Math.min(1, progress.current.value));

    // Camera travels on a 2-segment curve through the waypoints.
    const seg = Math.max(0, Math.min(1.999, p * 2));
    const i = Math.floor(seg);
    const t = seg - i;
    const smooth = t * t * (3 - 2 * t);
    const a = WAYPOINTS[i];
    const b = WAYPOINTS[i + 1];
    if (a && b) {
      state.camera.position.lerpVectors(a, b, smooth);
      state.camera.lookAt(0, 0, 0);
    }

    // Crossfade the three abstract stations by progress thirds.
    for (let k = 0; k < 3; k++) {
      applyStationWeight(groups.current[k] ?? null, stationWeight(p, k), delta);
    }
  });

  return (
    <>
      <color attach="background" args={["#05070f"]} />
      <fog attach="fog" args={["#05070f", 9, 20]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 6]} intensity={1.2} color="#dfe8ff" />
      <pointLight position={[-6, -2, 3]} intensity={14} color="#5982ff" />
      <pointLight position={[6, 3, -2]} intensity={12} color="#00d2b6" />
      <pointLight position={[0, -4, 4]} intensity={8} color="#a78bfa" />

      {/* Station 1 — photo analysis: wireframe-ish distort blob, blue */}
      <group
        ref={(el) => {
          groups.current[0] = el;
        }}
      >
        <Float speed={2.2} rotationIntensity={0.5} floatIntensity={1.4}>
          <mesh>
            <icosahedronGeometry args={[1.7, 6]} />
            <MeshDistortMaterial
              color="#0b1e4d"
              emissive="#5982ff"
              emissiveIntensity={0.55}
              roughness={0.25}
              metalness={0.1}
              distort={0.45}
              speed={2.2}
              transparent
            />
          </mesh>
          <mesh>
            <icosahedronGeometry args={[1.72, 3]} />
            <meshBasicMaterial color="#5982ff" wireframe transparent opacity={0.28} />
          </mesh>
        </Float>
      </group>

      {/* Station 2 — notes Q&A: torus knot, teal */}
      <group
        position={[0.7, 0.2, -0.6]}
        ref={(el) => {
          groups.current[1] = el;
        }}
      >
        <Float speed={1.8} rotationIntensity={0.7} floatIntensity={1.1}>
          <mesh rotation={[0.4, 0.2, 0]}>
            <torusKnotGeometry args={[1.05, 0.32, 220, 36]} />
            <MeshDistortMaterial
              color="#062a26"
              emissive="#00d2b6"
              emissiveIntensity={0.5}
              roughness={0.3}
              metalness={0.15}
              distort={0.3}
              speed={1.8}
              transparent
            />
          </mesh>
        </Float>
      </group>

      {/* Station 3 — timetable: ring/grid of instanced boxes, violet */}
      <group
        position={[-0.5, -0.2, -1]}
        ref={(el) => {
          groups.current[2] = el;
        }}
      >
        <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.8}>
          <StationRing />
        </Float>
      </group>

      <Sparkles count={70} scale={[14, 9, 9]} size={2.2} speed={0.3} opacity={0.5} color="#9db4ff" />
    </>
  );
}

function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

function StationCard({
  item,
  isActive,
}: {
  item: JourneyItem;
  isActive: boolean;
}): ReactNode {
  return (
    <article
      aria-hidden={!isActive}
      style={{
        opacity: isActive ? 1 : 0,
        transform: isActive ? "translate(-50%, 0)" : "translate(-50%, 18px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        pointerEvents: isActive ? "auto" : "none",
        borderColor: `${item.accent}66`,
        background: "rgba(9, 13, 26, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: isActive ? `0 18px 60px -18px ${item.accent}88` : "none",
      }}
      className="absolute bottom-0 left-1/2 w-full max-w-xl rounded-2xl border p-6 sm:p-7"
    >
      <div
        style={{ color: item.accent, borderColor: `${item.accent}55`, background: `${item.accent}14` }}
        className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border"
      >
        {item.icon}
      </div>
      <h3 className="text-xl font-semibold text-white sm:text-2xl">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70 sm:text-base">{item.desc}</p>
    </article>
  );
}

function FadeCard({ item }: { item: JourneyItem }): ReactNode {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <article
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        borderColor: `${item.accent}55`,
        background: "rgba(255, 255, 255, 0.03)",
        boxShadow: visible ? `0 14px 48px -14px ${item.accent}55` : "none",
      }}
      className="rounded-2xl border p-6 backdrop-blur"
    >
      <div
        style={{ color: item.accent, background: `${item.accent}14` }}
        className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl"
      >
        {item.icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{item.desc}</p>
    </article>
  );
}

export default function JourneySection({ kicker, lede, items }: JourneySectionProps): ReactNode {
  const [first, second, third] = items;
  const stations: JourneyItem[] = [first, second, third];
  const [mode, setMode] = useState<"desktop" | "fallback">("fallback");
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(0);
  const outerRef = useRef<HTMLElement>(null);
  const progressRef = useRef({ value: 0 });

  // Decide the rendering path once, client-side (SSR always starts on "fallback").
  useLayoutEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointerFine =
      window.matchMedia("(pointer: fine)").matches ||
      !window.matchMedia("(pointer: coarse)").matches;
    if (wide && !reduced && pointerFine && isWebGLAvailable()) {
      setMode("desktop");
    }
  }, []);

  // Pin + scrub + near-viewport canvas gating (desktop path only).
  useLayoutEffect(() => {
    if (mode !== "desktop") return;
    const outer = outerRef.current;
    if (!outer) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setInView(e.isIntersecting);
      },
      { rootMargin: "400px" },
    );
    io.observe(outer);

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: outer,
        start: "top top",
        end: "+=220%",
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          progressRef.current.value = self.progress;
          const idx = self.progress < 1 / 3 ? 0 : self.progress < 2 / 3 ? 1 : 2;
          setActive((prev) => (prev === idx ? prev : idx));
        },
      });
    }, outer);

    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, [mode]);

  if (mode === "fallback") {
    return (
      <section className="relative px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#5982ff]">{kicker}</p>
          <p className="mt-3 text-2xl font-bold leading-snug text-white sm:text-3xl">{lede}</p>
          <div className="mt-10 flex flex-col gap-5">
            {stations.map((s, i) => (
              <FadeCard key={i} item={s} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const activeItem = stations[active] ?? stations[0] ?? first;
  const activeAccent = activeItem.accent;

  return (
    <section ref={outerRef} className="relative z-0 h-[320vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {inView ? (
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <Suspense fallback={null}>
              <Canvas
                dpr={[1, 2]}
                camera={{ position: [0, 0.5, 7.6], fov: 42 }}
                gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              >
                <JourneyScene progress={progressRef} />
              </Canvas>
            </Suspense>
          </div>
        ) : null}

        {/* soft vignette to keep overlay text readable */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 45%, transparent 55%, rgba(3, 5, 12, 0.55) 100%)",
          }}
        />

        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col px-6 pb-10 pt-24 sm:pt-28">
          <p
            className="text-sm font-semibold uppercase tracking-widest"
            style={{ color: activeAccent, transition: "color 0.5s ease" }}
          >
            {kicker}
          </p>
          <p className="mt-3 max-w-2xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            {lede}
          </p>

          <div className="relative mt-auto h-64 sm:h-56">
            {stations.map((s, i) => (
              <StationCard key={i} item={s} isActive={i === active} />
            ))}
          </div>

          <div aria-hidden="true" className="mt-6 flex items-center justify-center gap-2.5">
            {stations.map((s, i) => (
              <span
                key={i}
                style={{
                  background: i === active ? s.accent : "rgba(255,255,255,0.18)",
                  width: i === active ? 28 : 8,
                  transition: "all 0.4s ease",
                  boxShadow: i === active ? `0 0 12px ${s.accent}` : "none",
                }}
                className="h-2 rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
