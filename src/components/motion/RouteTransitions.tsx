"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { GlimmProvider, InterceptLinks } from "glimm/next";
import type { Palette } from "glimm/next";

export interface RouteTransitionsProps {
  children: ReactNode;
}

/** Site-matched sweep palette: #5982ff blue + #00d2b6 teal accents. */
const MONCEF_PALETTE: Palette = {
  a: [0.35, 0.51, 1.0],
  b: [0.05, 0.09, 0.22],
  c: [0.5, 0.5, 0.5],
  d: [0.0, 0.82, 0.71],
};

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

/**
 * Mounts the Glimm page-transition provider. InterceptLinks is a
 * null-rendering component that installs a delegated click listener for
 * internal links. If WebGL is unavailable or the user prefers reduced
 * motion, children render without any interception.
 */
export default function RouteTransitions({ children }: RouteTransitionsProps) {
  // Client-only gating after hydration so SSR and the first paint agree.
  const [ready, setReady] = useState<boolean>(false);
  const [gl, setGl] = useState<boolean>(false);

  useEffect(() => {
    setGl(webglAvailable());
    setReady(true);
  }, []);

  if (!ready || !gl) return <>{children}</>;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return <>{children}</>;
  }

  return (
    <GlimmProvider palette={MONCEF_PALETTE}>
      <InterceptLinks />
      {children}
    </GlimmProvider>
  );
}
