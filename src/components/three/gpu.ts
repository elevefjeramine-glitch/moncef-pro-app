/**
 * GPU / capability helpers for the hero 3D scene.
 *
 * Every function is SSR-safe: when `window` is unavailable they return
 * conservative defaults (i.e. the values that disable the animated 3D
 * layers and fall back to the static poster).
 */

/** True when a WebGL2 (or fallback WebGL1) context can be created. */
export function supportsWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    return gl !== null;
  } catch {
    return false;
  }
}

/** True when the OS requests reduced motion. Conservative default on SSR: true. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when the primary pointer is NOT fine (touch / coarse). Conservative default on SSR: true. */
export function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(pointer: fine)").matches;
}

/**
 * Heuristic for low-end devices: few CPU cores AND a small screen.
 * Conservative default on SSR: true.
 */
export function isWeakDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const cores = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 0;
  const minDim = Math.min(window.innerWidth, window.innerHeight);
  return cores <= 4 && minDim < 768;
}

/** Master switch: render the WebGL hero layers, or fall back to the static poster. */
export function shouldUseWebGL(): boolean {
  return supportsWebGL() && !prefersReducedMotion() && !isWeakDevice();
}
