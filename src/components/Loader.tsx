"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";

// Fallback skeleton animation
const loaderAnimation = {
  v: "5.7.4",
  fr: 60,
  ip: 0,
  op: 60,
  w: 500,
  h: 500,
  nm: "Loading",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "Circle",
      sr: 1,
      ks: {
        o: { a: 1, k: [{ i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 0, s: [0] }, { i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t: 30, s: [100] }, { t: 60, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [250, 250, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ i: { x: [0.833, 0.833, 0.833] }, o: { x: [0.167, 0.167, 0.167] }, t: 0, s: [0, 0, 100] }, { t: 60, s: [100, 100, 100] }] }
      },
      ao: 0,
      shapes: [
        {
          ty: "el",
          d: 1,
          p: { a: 0, k: [0, 0] },
          s: { a: 0, k: [200, 200] },
          nm: "Ellipse Path 1",
          hd: false
        },
        {
          ty: "st",
          c: { a: 0, k: [0.35, 0.51, 1, 1] },
          o: { a: 0, k: 100 },
          w: { a: 0, k: 10 },
          lc: 1,
          lj: 1,
          ml: 4,
          bm: 0,
          nm: "Stroke 1",
          hd: false
        }
      ]
    }
  ],
  markers: []
};

export default function Loader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="global-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          style={{ 
            overflow: "hidden", position: "fixed", inset: 0, zIndex: 9999, 
            background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" 
          }}
        >
          <div style={{ width: 120, height: 120 }}>
            <Lottie animationData={loaderAnimation} loop={true} />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ marginTop: 24, fontSize: 13, color: "var(--muted-foreground)", fontFamily: "var(--font-sans)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            System Initialization
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

