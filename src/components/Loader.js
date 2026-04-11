"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Loader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800); // Affichage prolongé pour effet wow
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          className="global-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: "-100%", borderRadius: "0 0 50% 50%" }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="loader-content"
          >
            <div className="loader-logo">🎓 Moncef <span style={{ color: 'var(--a)' }}>IA</span></div>
            <motion.div 
              className="loader-bar-bg"
            >
              <motion.div 
                className="loader-bar"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5, ease: "circOut" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
