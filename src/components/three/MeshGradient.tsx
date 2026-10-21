"use client";

import { useEffect, useRef, useState } from "react";
import { shouldUseWebGL } from "./gpu";

/* ------------------------------------------------------------------ */
/* Static "poster" fallback: pure CSS radial gradients, zero WebGL.    */
/* ------------------------------------------------------------------ */

function PosterFallback({ className }: { className?: string | undefined }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(120% 90% at 15% 8%, rgba(89, 130, 255, 0.38), transparent 60%)," +
          "radial-gradient(100% 85% at 88% 18%, rgba(167, 139, 250, 0.30), transparent 58%)," +
          "radial-gradient(95% 90% at 50% 105%, rgba(0, 210, 182, 0.24), transparent 62%)," +
          "radial-gradient(70% 60% at 70% 70%, rgba(59, 91, 255, 0.16), transparent 60%)," +
          "#060a12",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Shaders. Heavy domain-drift math lives in the VERTEX stage (a dense */
/* grid), so the fragment stage only blends a modest-octave fbm field. */
/* ------------------------------------------------------------------ */

const VERT_SRC = /* glsl */ `
attribute vec2 a_pos;
uniform float u_time;
uniform vec2 u_pointer;
varying vec2 v_uv;
varying vec2 v_warp;

void main() {
  v_uv = a_pos * 0.5 + 0.5;
  float t = u_time;

  // Organic drift field: several slow trig layers sampled per-vertex.
  // On a subdivided grid this is smooth; the fragment adds fine detail.
  vec2 p = a_pos;
  vec2 drift = vec2(
    sin(p.y * 2.6 + t * 0.22) + sin(p.x * 1.9 - t * 0.14) + sin((p.x + p.y) * 3.4 + t * 0.07),
    cos(p.x * 2.2 + t * 0.18) + cos(p.y * 3.1 - t * 0.11) + cos((p.x - p.y) * 2.7 + t * 0.09)
  );

  // Second, slower layer for large-scale "melting" motion.
  vec2 melt = vec2(
    sin(p.y * 1.1 - t * 0.06 + 1.7) + cos(p.x * 0.9 + t * 0.05),
    cos(p.x * 1.3 + t * 0.07 + 0.6) + sin(p.y * 0.8 - t * 0.05)
  );

  // Cursor-reactive warp (gentle, smoothed in JS before upload).
  vec2 cursor = u_pointer * (0.55 + 0.25 * sin(t * 0.4));

  v_warp = p + drift * 0.28 + melt * 0.45 + cursor * 0.35;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG_SRC = /* glsl */ `
precision highp float;
varying vec2 v_uv;
varying vec2 v_warp;
uniform float u_time;
uniform vec2 u_res;

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Modest octave count: the vertex stage already carries the big motion.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec2(17.3, 9.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 q = v_warp * aspect * 1.35;

  // Domain warp on top of the vertex-space drift.
  vec2 w = vec2(
    fbm(q + vec2(0.0, u_time * 0.04)),
    fbm(q + vec2(5.2, 1.3) - u_time * 0.03)
  );
  float f = fbm(q + 1.5 * w);

  vec3 bg     = vec3(0.0235, 0.0392, 0.0706); // deep dark #060a12
  vec3 blue   = vec3(0.3490, 0.5098, 1.0000); // #5982ff
  vec3 teal   = vec3(0.0000, 0.8235, 0.7137); // #00d2b6
  vec3 violet = vec3(0.6549, 0.5451, 0.9804); // #a78bfa
  vec3 gold   = vec3(0.9608, 0.7725, 0.0941); // #f5c518 (whisper)

  vec3 col = bg;
  col = mix(col, blue,   smoothstep(0.28, 0.78, f));
  col = mix(col, teal,   smoothstep(0.45, 0.92, fbm(q - 0.9 * w + 2.7)));
  col = mix(col, violet, smoothstep(0.55, 0.95, fbm(q + 0.7 * w + 4.1)));
  col = mix(col, gold,   smoothstep(0.78, 0.98, fbm(q * 1.7 - w + 8.4)) * 0.22);

  // Gentle center lift so hero content stays readable at the edges.
  float d = length(v_uv - vec2(0.5));
  col *= 0.72 + 0.28 * smoothstep(0.75, 0.15, d);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Build a subdivided fullscreen grid (clip space) so the vertex shader carries spatial detail. */
function buildGrid(segments: number): { positions: Float32Array; indices: Uint16Array } {
  const vertsPerSide = segments + 1;
  const positions = new Float32Array(vertsPerSide * vertsPerSide * 2);
  let k = 0;
  for (let y = 0; y < vertsPerSide; y++) {
    for (let x = 0; x < vertsPerSide; x++) {
      positions[k++] = (x / segments) * 2 - 1;
      positions[k++] = (y / segments) * 2 - 1;
    }
  }
  const indices = new Uint16Array(segments * segments * 6);
  let i = 0;
  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * vertsPerSide + x;
      const b = a + 1;
      const c = a + vertsPerSide;
      const d = c + 1;
      indices[i++] = a;
      indices[i++] = c;
      indices[i++] = b;
      indices[i++] = b;
      indices[i++] = c;
      indices[i++] = d;
    }
  }
  return { positions, indices };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface MeshGradientProps {
  className?: string;
}

export function MeshGradient({ className }: MeshGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useWebgl, setUseWebgl] = useState(false);

  // Decide after mount: SSR and first paint render the poster (no mismatch).
  useEffect(() => {
    setUseWebgl(shouldUseWebGL());
  }, []);

  useEffect(() => {
    if (!useWebgl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) {
      setUseWebgl(false);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) {
      setUseWebgl(false);
      return;
    }
    const program = gl.createProgram();
    if (!program) {
      setUseWebgl(false);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseWebgl(false);
      return;
    }
    gl.useProgram(program);

    const posLoc = gl.getAttribLocation(program, "a_pos");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const pointerLoc = gl.getUniformLocation(program, "u_pointer");
    const resLoc = gl.getUniformLocation(program, "u_res");

    const { positions, indices } = buildGrid(56);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    if (posLoc >= 0) {
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * DPR));
      const h = Math.max(1, Math.floor(canvas.clientHeight * DPR));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(resLoc, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Cursor warp: smoothed target, only for fine pointers.
    const finePointer =
      typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMouseMove = (e: MouseEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    if (finePointer) window.addEventListener("mousemove", onMouseMove, { passive: true });

    let raf = 0;
    let running = true;
    const start = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      gl.uniform1f(timeLoc, (now - start) / 1000);
      gl.uniform2f(pointerLoc, pointer.x, pointer.y);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      if (finePointer) window.removeEventListener("mousemove", onMouseMove);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ibo);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [useWebgl]);

  if (!useWebgl) {
    return <PosterFallback className={className} />;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
    />
  );
}
