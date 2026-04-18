"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Loader() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress counter
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.random() * 18 + 6;
      });
    }, 100);

    const timer = setTimeout(() => {
      setLoading(false);
    }, 1600);

    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="global-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(12px)" }}
          transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          style={{ overflow: "hidden" }}
        >
          {/* Background gradient orb */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.55, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              width: "60vw", height: "60vw", maxWidth: 500, maxHeight: 500,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(89,130,255,0.25) 0%, rgba(0,208,178,0.15) 40%, transparent 70%)",
              filter: "blur(60px)",
              pointerEvents: "none"
            }}
          />

          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="loader-content"
            style={{ position: "relative", zIndex: 1 }}
          >
            {/* Logo */}
            <motion.div
              className="loader-logo"
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{
                background: "linear-gradient(135deg, #fff 0%, hsl(174,100%,65%) 33%, hsl(224,100%,72%) 66%, hsl(263,90%,75%) 100%)",
                backgroundSize: "300% 300%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                WebkitTextFillColor: "transparent",
              }}
            >
              🎓 Moncef IA
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                fontSize: 13, color: "rgba(255,255,255,0.35)",
                marginBottom: 28, fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.04em"
              }}
            >
              Chargement de l'univers...
            </motion.p>

            {/* Progress bar */}
            <div className="loader-bar-bg">
              <motion.div
                className="loader-bar"
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ ease: "circOut", duration: 0.3 }}
              />
            </div>

            {/* Progress number */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                marginTop: 12, fontSize: 11.5, color: "rgba(255,255,255,0.25)",
                fontFamily: "'JetBrains Mono', monospace", textAlign: "center"
              }}
            >
              {Math.min(Math.round(progress), 100)}%
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
